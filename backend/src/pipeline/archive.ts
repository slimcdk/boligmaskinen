import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, rmdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type pg from 'pg';
import { formatBytes } from '../jobs/data-pack.ts';
import type { JobContext } from '../jobs/types.ts';

/** How the data jobs introduce themselves to the sources. */
export const USER_AGENT = 'Boligmaskinen data jobs (self-hosted home search; github.com/slimcdk/boligmaskinen)';

/** A file in the raw archive. */
export interface SourceFile {
  id: string;
  source: string;
  name: string;
  url: string;
  licence: string;
  /** Absolute. */
  path: string;
  bytes: number;
  sha256: string;
  fingerprint: string;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: string;
  checkedAt: string;
}

/** What a file in the archive is and where it came from. */
export interface FileSpec {
  /** The job that fetches it. */
  source: string;
  /** Its name in the source, e.g. "denmark-latest.osm.pbf" or "fonts/noto-regular/0-255.pbf". */
  name: string;
  url: string;
  licence: string;
  /** The content without what changes with every answer, such as a time stamp: it is hashed instead. */
  normalize?: (content: Buffer) => Buffer | string;
  /**
   * Checks that the content is what the source gives, and says what it holds, such as "6,250
   * polygons". It throws when the content is wrong, and then the file is not kept.
   */
  check?: (content: Buffer) => string;
}

/** A file to fetch over HTTP. */
export interface Download extends FileSpec {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  /** The part of the run's progress the download fills. */
  progress?: [number, number];
}

export interface Archived {
  file: SourceFile;
  /** False when the source has the same content as the newest file in the archive. */
  changed: boolean;
  /** What the file holds, from the spec's `check`. */
  summary?: string;
}

/** What is known about a fetched file: its hash and size when they were counted on the way, and the server's validators. */
export interface Fetched {
  sha256?: string;
  bytes?: number;
  etag?: string | null;
  lastModified?: string | null;
}

interface Row {
  id: string;
  source: string;
  name: string;
  url: string;
  licence: string;
  path: string;
  bytes: string;
  sha256: string;
  fingerprint: string;
  etag: string | null;
  last_modified: string | null;
  fetched_at: Date;
  checked_at: Date;
}

const exists = async (path: string) => stat(path).then(() => true, () => false);

async function hashFile(path: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
    bytes += (chunk as Buffer).length;
  }
  return { sha256: hash.digest('hex'), bytes };
}

/**
 * The raw archive: every file the data jobs fetch, kept unchanged under DATA_DIR/raw, with a row in
 * source_file for where it came from, its licence and its hash. A file that has not changed is not
 * kept again, and the next fetch asks the server whether it changed (ETag, Last-Modified), so an
 * unchanged source is not processed again. The newest `keep` files of each name are kept.
 */
export class Archive {
  readonly db: pg.Pool;
  readonly dataDir: string;
  readonly keep: number;

  constructor(db: pg.Pool, dataDir: string, keep = 3) {
    this.db = db;
    this.dataDir = dataDir;
    this.keep = keep;
  }

  private toFile(row: Row): SourceFile {
    return {
      id: String(row.id), source: row.source, name: row.name, url: row.url, licence: row.licence, path: join(this.dataDir, row.path),
      bytes: Number(row.bytes), sha256: row.sha256, fingerprint: row.fingerprint, etag: row.etag, lastModified: row.last_modified,
      fetchedAt: row.fetched_at.toISOString(), checkedAt: row.checked_at.toISOString(),
    };
  }

  /** Where downloads go while they are fetched; it is on the same disk, so keeping one is a rename. */
  get tmpDir(): string {
    return join(this.dataDir, 'tmp');
  }

  /** A new path in the folder for downloads. */
  async tmpPath(suffix = ''): Promise<string> {
    await mkdir(this.tmpDir, { recursive: true });
    return join(this.tmpDir, `${randomBytes(8).toString('hex')}${suffix}`);
  }

  /** The newest file of a source's name, or null. */
  async newest(source: string, name: string): Promise<SourceFile | null> {
    const { rows } = await this.db.query<Row>(
      'select * from source_file where source = $1 and name = $2 and pruned_at is null order by id desc limit 1', [source, name],
    );
    return rows[0] ? this.toFile(rows[0]) : null;
  }

  /** The newest file of every name a source has, by name. */
  async current(source: string): Promise<Map<string, SourceFile>> {
    const { rows } = await this.db.query<Row>(
      'select distinct on (name) * from source_file where source = $1 and pruned_at is null order by name, id desc', [source],
    );
    return new Map(rows.map((row) => [row.name, this.toFile(row)]));
  }

  /** Whether the newest file of a name is in the archive and on disk. */
  async present(file: SourceFile | null): Promise<boolean> {
    return !!file && exists(file.path);
  }

  /**
   * Fetches a file into the archive. When the newest file of its name is on disk, the server is
   * asked whether it changed, and a 304 fetches nothing.
   */
  async download(context: JobContext, spec: Download): Promise<Archived> {
    const newest = await this.newest(spec.source, spec.name);
    const present = await this.present(newest);
    const method = spec.method ?? 'GET';
    const headers: Record<string, string> = { 'user-agent': USER_AGENT, ...spec.headers };
    if (present && newest && method === 'GET') {
      if (newest.etag) headers['if-none-match'] = newest.etag;
      if (newest.lastModified) headers['if-modified-since'] = newest.lastModified;
    }
    const response = await fetch(spec.url, { method, headers, body: spec.body, signal: context.signal });
    if (response.status === 304 && present && newest) {
      await response.body?.cancel();
      return { file: await this.touch(newest, {}), changed: false };
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(`${spec.url} answered ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`);
    }

    const tmp = await this.tmpPath();
    const total = Number(response.headers.get('content-length')) || 0;
    const [from, to] = spec.progress ?? [0, 0];
    const hash = createHash('sha256');
    let bytes = 0;
    let reported = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        hash.update(chunk);
        bytes += chunk.length;
        // A few updates of the progress bar, not one per chunk
        if (total && to > from && bytes - reported > total / 50) {
          reported = bytes;
          void context.progress(from + ((to - from) * bytes) / total);
        }
        done(null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(response.body as WebReadableStream<Uint8Array>), meter, createWriteStream(tmp), { signal: context.signal });
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
    return this.keepFile(context, spec, tmp, {
      sha256: hash.digest('hex'), bytes, etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified'),
    });
  }

  /**
   * Keeps a file that was fetched into the folder for downloads. When it has the content of the
   * newest file of its name, it is deleted again.
   */
  async keepFile(context: JobContext, spec: FileSpec, tmp: string, known: Fetched = {}): Promise<Archived> {
    return (await this.keepFiles(context, [{ spec, tmp, known }]))[0];
  }

  /**
   * Keeps files that belong together, such as the parts of a shapefile: when one of them changed,
   * all of them are kept again, in one folder.
   */
  async keepFiles(context: JobContext, files: { spec: FileSpec; tmp: string; known?: Fetched }[]): Promise<Archived[]> {
    const prepared = [];
    try {
      for (const { spec, tmp, known = {} } of files) {
        const name = normalize(spec.name);
        if (isAbsolute(name) || name.startsWith('..')) throw new Error(`Not a file name in the archive: ${spec.name}`);
        const { sha256, bytes } = known.sha256 && known.bytes !== undefined ? { sha256: known.sha256, bytes: known.bytes } : await hashFile(tmp);
        const content = spec.normalize || spec.check ? await readFile(tmp) : null;
        let summary: string | undefined;
        try {
          summary = spec.check?.(content!);
        } catch (error) {
          throw new Error(`${spec.url} did not give what it should: ${(error as Error).message}`, { cause: error });
        }
        const fingerprint = spec.normalize ? createHash('sha256').update(spec.normalize(content!)).digest('hex') : sha256;
        const newest = await this.newest(spec.source, name);
        prepared.push({
          spec, name, tmp, sha256, bytes, fingerprint, summary, newest, present: await this.present(newest),
          validators: { etag: known.etag ?? null, lastModified: known.lastModified ?? null },
        });
      }
    } catch (error) {
      for (const { tmp } of files) await rm(tmp, { force: true });
      throw error;
    }

    if (prepared.every((f) => f.present && f.newest!.fingerprint === f.fingerprint)) {
      for (const f of prepared) await rm(f.tmp, { force: true });
      return Promise.all(prepared.map(async (f) => ({ file: await this.touch(f.newest!, f.validators), changed: false, summary: f.summary })));
    }
    const stamp = `${new Date().toISOString().slice(0, 10)}-run${context.runId}`;
    const archived: Archived[] = [];
    for (const f of prepared) {
      const path = join('raw', f.spec.source, stamp, f.name);
      await mkdir(dirname(join(this.dataDir, path)), { recursive: true });
      await rename(f.tmp, join(this.dataDir, path));
      const { rows: [row] } = await this.db.query<Row>(
        `insert into source_file (source, name, url, licence, path, bytes, sha256, fingerprint, etag, last_modified, run_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
        [f.spec.source, f.name, f.spec.url, f.spec.licence, path, f.bytes, f.sha256, f.fingerprint, f.validators.etag, f.validators.lastModified, context.runId],
      );
      await this.prune(f.spec.source, f.name);
      archived.push({ file: this.toFile(row), changed: true, summary: f.summary });
    }
    // Content that only came back after its file was lost is not new
    if (prepared.every((f) => f.newest?.fingerprint === f.fingerprint)) for (const a of archived) a.changed = false;
    return archived;
  }

  /** Records that a file was found unchanged, with the server's validators when it sent new ones. */
  async touch(file: SourceFile, validators: { etag?: string | null; lastModified?: string | null }): Promise<SourceFile> {
    const { rows: [row] } = await this.db.query<Row>(
      `update source_file set checked_at = now(), etag = coalesce($2, etag), last_modified = coalesce($3, last_modified)
       where id = $1 returning *`,
      [file.id, validators.etag ?? null, validators.lastModified ?? null],
    );
    return this.toFile(row);
  }

  /** Deletes all but the newest `keep` files of a name; their rows stay, marked as pruned. */
  private async prune(source: string, name: string): Promise<void> {
    const { rows } = await this.db.query<{ id: string; path: string }>(
      `select id, path from source_file where source = $1 and name = $2 and pruned_at is null order by id desc offset $3`,
      [source, name, this.keep],
    );
    for (const row of rows) {
      const path = join(this.dataDir, row.path);
      await rm(path, { force: true });
      // The run's folder goes when its last file has
      const top = join(this.dataDir, 'raw', source);
      for (let dir = dirname(path); dir.startsWith(top + sep); dir = dirname(dir)) {
        if (!(await rmdir(dir).then(() => true, () => false))) break;
      }
      await this.db.query('update source_file set pruned_at = now() where id = $1', [row.id]);
    }
  }

  /** Removes what downloads left behind when the app stopped during one. */
  async cleanTmp(): Promise<void> {
    await rm(this.tmpDir, { recursive: true, force: true });
  }
}

/** "unchanged since 2026-10-08" or "512 MB, new"; `day` writes the date, by default in UTC. */
export function freshness(archived: Archived, day = (iso: string) => iso.slice(0, 10)): string {
  return archived.changed ? `${formatBytes(archived.file.bytes)}, new` : `unchanged since ${day(archived.file.fetchedAt)}`;
}
