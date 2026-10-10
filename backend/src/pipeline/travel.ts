import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { roadVersions } from './builds.ts';
import { runStep } from './python.ts';

export const TRAVEL_MODES = ['car', 'bike', 'walk', 'transit'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

/** How far the travel times to a place are: the shape POST /api/travel answers with. */
export interface TravelState {
  /** Names the travel times to one position, on the data pack and road network in use. */
  id: string;
  state: 'ready' | 'working' | 'failed' | 'unavailable';
  /** Why there are none. */
  message?: string;
  /** The modes there are travel times by, when they are ready: by public transport only on a network with a timetable. */
  modes?: TravelMode[];
}

export interface TravelOptions {
  dataDir: string;
  /** The link to the data pack in use. */
  dataPackDir: string;
  python: string;
  log: (text: string) => void;
}

/** The travel times of this many places are kept for the pack and network in use. */
const KEEP = 200;
const ID = /^[0-9a-f]{24}$/;

/**
 * The travel times to the user's places by car, by bike, on foot and by public transport, found on
 * the road network and its timetable for every cell of the data pack in use. The first request for a position starts the travel step,
 * which takes a few seconds once the pack's cells are matched to the network; the result is kept
 * in DATA_DIR/travel, one folder per pack and network, and the folders of older ones are removed.
 */
export class TravelTimes {
  private readonly working = new Map<string, Promise<void>>();
  /** Why finding the travel times to an id failed, for the pack and network in use. */
  private readonly failed = new Map<string, string>();
  private basisDir = '';

  private readonly options: TravelOptions;

  constructor(options: TravelOptions) {
    this.options = options;
  }

  /** The pack and road network travel times are found on now, and where their results go. */
  private async basis(): Promise<{ pack: string; roads: string; dir: string } | { unavailable: string }> {
    const pack = await realpath(this.options.dataPackDir).catch(() => null);
    if (!pack) return { unavailable: 'There is no data pack yet' };
    const roads = await roadVersions(this.options.dataDir).current();
    if (!roads) return { unavailable: 'The road network is not built yet: the Road network job builds it' };
    const meta = await readFile(join(pack, 'data', 'meta.json'), 'utf8').then((text) => JSON.parse(text) as { pack?: string }, () => ({ pack: undefined }));
    return { pack, roads, dir: join(this.options.dataDir, 'travel', `${meta.pack ?? basename(pack)}--${basename(roads)}`) };
  }

  /** How far the travel times to a position are, starting to find them when nobody has. */
  async request(lng: number, lat: number): Promise<TravelState> {
    const basis = await this.basis();
    if ('unavailable' in basis) return { id: '', state: 'unavailable', message: basis.unavailable };
    if (basis.dir !== this.basisDir) {
      // A new pack or network: what failed may work now
      this.basisDir = basis.dir;
      this.failed.clear();
    }
    const position = `${lng.toFixed(5)},${lat.toFixed(5)}`;
    const id = createHash('sha256').update(`${basename(basis.dir)}|${position}`).digest('hex').slice(0, 24);
    const dir = join(basis.dir, id);
    if (await exists(dir)) return { id, state: 'ready', modes: await modesIn(dir) };
    const failure = this.failed.get(id);
    if (failure) return { id, state: 'failed', message: failure };
    if (!this.working.has(id)) {
      const work = this.find(basis, id, position)
        .catch((error: Error) => {
          this.failed.set(id, error.message);
          this.options.log(`The travel times to ${position} failed: ${error.message}`);
        })
        .finally(() => this.working.delete(id));
      this.working.set(id, work);
    }
    return { id, state: 'working' };
  }

  /** The file of one mode's travel times, when they are there. */
  async file(id: string, mode: TravelMode): Promise<string | null> {
    const basis = await this.basis();
    if ('unavailable' in basis || !ID.test(id)) return null;
    const file = join(basis.dir, id, `${mode}.png`);
    return (await exists(file)) ? file : null;
  }

  private async find(basis: { pack: string; roads: string; dir: string }, id: string, position: string): Promise<void> {
    await this.forgetOthers(basis.dir);
    const stage = join(basis.dir, `.${id}-${randomBytes(4).toString('hex')}`);
    await mkdir(stage, { recursive: true });
    const tmpDir = join(this.options.dataDir, 'tmp');
    await mkdir(tmpDir, { recursive: true });
    const [lng, lat] = position.split(',');
    const context = {
      log: async (text: string) => this.options.log(`Travel times to ${position}: ${text}`),
      progress: async () => undefined,
      signal: new AbortController().signal,
    };
    try {
      await runStep(context, { python: this.options.python, tmpDir }, 'travel', [basis.roads, basis.pack, lng, lat, stage, '--cache', join(basis.dir, 'cells')]);
      await rename(stage, join(basis.dir, id));
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
    await this.prune(basis.dir);
  }

  /** The travel times found on other packs and networks are of no use any more. */
  private async forgetOthers(current: string): Promise<void> {
    const root = join(this.options.dataDir, 'travel');
    const kept = await readdir(root).catch(() => []);
    for (const name of kept) if (join(root, name) !== current) await rm(join(root, name), { recursive: true, force: true });
  }

  /** The KEEP newest results stay. */
  private async prune(dir: string): Promise<void> {
    const results = (await readdir(dir)).filter((name) => ID.test(name));
    if (results.length <= KEEP) return;
    const dated = await Promise.all(results.map(async (name) => ({ name, at: (await stat(join(dir, name))).mtimeMs })));
    dated.sort((a, b) => b.at - a.at);
    for (const { name } of dated.slice(KEEP)) await rm(join(dir, name), { recursive: true, force: true });
  }
}

const exists = (path: string) => stat(path).then(() => true, () => false);

async function modesIn(dir: string): Promise<TravelMode[]> {
  const found = await Promise.all(TRAVEL_MODES.map((mode) => exists(join(dir, `${mode}.png`))));
  return TRAVEL_MODES.filter((_, i) => found[i]);
}
