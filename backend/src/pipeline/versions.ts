import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readlink, realpath, rename, rm, symlink } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';

/**
 * A folder that is replaced as a whole, such as the OSM extract or a data pack. Each version is
 * built beside the others and then switched in at once: a symbolic link points at the current
 * one, and is replaced with a rename, so a reader sees either the old version or the new one,
 * never half of one. The newest `keep` versions stay, so a reader that is still busy with the
 * old one can finish.
 */
export class Versions {
  /** Where the versions are, each in a folder named by its id. */
  readonly root: string;
  /** The link to the current version. */
  readonly link: string;
  readonly keep: number;

  constructor(root: string, options: { link?: string; keep?: number } = {}) {
    this.root = root;
    this.link = options.link ?? join(root, 'current');
    this.keep = options.keep ?? 2;
  }

  /** A new, empty folder to build the next version in; `publish` switches it in. */
  async staging(id: string): Promise<string> {
    const dir = join(this.root, `.staging-${id}`);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    return dir;
  }

  /** The current version's folder, or null when there is none. */
  async current(): Promise<string | null> {
    try {
      return await realpath(this.link);
    } catch {
      return null;
    }
  }

  /** The current version's id: the name of its folder. */
  async currentId(): Promise<string | null> {
    const dir = await this.current();
    return dir ? basename(dir) : null;
  }

  /** Every version's id, oldest first. */
  async ids(): Promise<string[]> {
    const entries = await readdir(this.root, { withFileTypes: true }).catch(() => []);
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort();
  }

  /**
   * Makes a built folder the current version: it is moved to its place, and the link is switched to
   * it in one rename. Ids sort in the order they were made in.
   */
  async publish(staging: string, id: string): Promise<string> {
    const dir = join(this.root, id);
    await rename(staging, dir);
    await mkdir(dirname(this.link), { recursive: true });
    const tmp = join(dirname(this.link), `.link-${randomBytes(6).toString('hex')}`);
    await symlink(relative(dirname(this.link), dir), tmp);
    await rename(tmp, this.link);
    await this.prune();
    return dir;
  }

  /** Deletes the oldest versions, never the current one. */
  async prune(): Promise<void> {
    const current = await this.currentId();
    const ids = await this.ids();
    for (const id of ids.slice(0, Math.max(0, ids.length - this.keep))) {
      if (id !== current) await rm(join(this.root, id), { recursive: true, force: true });
    }
    for (const entry of await readdir(this.root).catch(() => [])) {
      if (entry.startsWith('.staging-')) await rm(join(this.root, entry), { recursive: true, force: true });
    }
  }

  /** Whether the link is a link, rather than a folder from before there were versions. */
  async isLink(): Promise<boolean> {
    return readlink(this.link).then(() => true, () => false);
  }
}
