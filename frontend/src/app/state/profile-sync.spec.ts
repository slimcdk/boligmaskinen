import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityVersion, Profile, ProfileChange, ProfileConflicts, ProfileSaved, StoredMap, StoredPlace } from '@boligmaskinen/engine';
import { ProfileApi, ProfileApiError } from './profile-api';
import { ProfileSync, SYNC_TIMING } from './profile-sync';
import { FIRST_MAP, Store } from './store';

/** The backend's saved maps in memory, with its versions and conflicts (backend/src/profile/store.ts). */
class FakeServer {
  epoch = 'e1';
  revision = 0;
  readonly maps = new Map<string, StoredMap>();
  readonly places = new Map<string, StoredPlace>();
  /** The server cannot be reached. */
  down = false;
  /** There is no server keeping maps. */
  missing = false;
  readonly saves: ProfileChange[][] = [];

  async load(etag: string | null): Promise<{ profile: Profile; etag: string } | 'unchanged'> {
    this.check();
    const tag = `"${this.epoch}-${this.revision}"`;
    if (etag === tag) return 'unchanged';
    return { profile: { epoch: this.epoch, revision: this.revision, maps: [...this.maps.values()], places: [...this.places.values()] }, etag: tag };
  }

  async save(changes: ProfileChange[]): Promise<ProfileSaved | ProfileConflicts> {
    this.check();
    this.saves.push(changes);
    const tableOf = (kind: 'map' | 'place') => (kind === 'map' ? this.maps : this.places) as Map<string, { version: number }>;
    const conflicts: EntityVersion[] = changes
      .map((c) => ({ kind: c.kind, id: c.id, version: tableOf(c.kind).get(c.id)?.version ?? null }))
      .filter((current, i) => (changes[i].value === null ? current.version !== null && current.version !== changes[i].base : current.version !== changes[i].base));
    if (conflicts.length) return { conflicts };
    const saved = changes.map((c) => {
      const table = tableOf(c.kind) as Map<string, object>;
      if (c.value === null) {
        table.delete(c.id);
        return { kind: c.kind, id: c.id, version: null };
      }
      const version = (tableOf(c.kind).get(c.id)?.version ?? 0) + 1;
      table.set(c.id, { id: c.id, ...c.value, version, updatedAt: 'now' });
      return { kind: c.kind, id: c.id, version };
    });
    return { revision: ++this.revision, saved };
  }

  private check(): void {
    if (this.missing) throw new ProfileApiError('No saved maps here (HTTP 200)', true);
    if (this.down) throw new ProfileApiError('The server cannot be reached', false);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ProfileSync', () => {
  let server: FakeServer;
  let store: Store;
  let sync: ProfileSync;
  let snackBar: { open: ReturnType<typeof vi.fn> };

  function setUp(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ProfileApi, useValue: server },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: SYNC_TIMING, useValue: { saveAfterMs: 10, pollMs: 60_000, retryMs: 40 } },
      ],
    });
    store = TestBed.inject(Store);
    sync = TestBed.inject(ProfileSync);
  }

  /** Let effects, timers and saves run. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 8; i++) {
      TestBed.tick();
      await wait(15);
    }
  }

  beforeEach(() => {
    localStorage.clear();
    server = new FakeServer();
    snackBar = { open: vi.fn() };
    setUp();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('keeps the maps in this browser when nothing here keeps them', async () => {
    server.missing = true;
    await sync.start();
    expect(sync.status()).toBe('local');
    store.addTemplate('forest');
    await settle();
    expect(server.saves).toEqual([]);
  });

  it('saves what this browser has to a server that has nothing, and then each change a moment later', async () => {
    store.addTemplate('forest');
    await sync.start();
    expect(sync.status()).toBe('saved');
    expect([...server.maps.values()].map((m) => [m.name, m.blocks.map((b) => b.name)])).toEqual([[FIRST_MAP, ['Forest']]]);

    store.addTemplate('noise');
    TestBed.tick();
    expect(sync.status()).toBe('saving');
    await settle();
    expect(sync.status()).toBe('saved');
    expect([...server.maps.values()][0].blocks.map((b) => b.name)).toEqual(['Forest', 'Quiet']);
    // Places too, and with them the map that got the place's block
    store.addPlace(10.2, 56.15);
    await settle();
    expect([...server.places.values()]).toMatchObject([{ name: 'Place 1', lng: 10.2, lat: 56.15, version: 1 }]);
    expect([...server.maps.values()][0]).toMatchObject({ version: 3 });
  });

  it('gives a new browser the maps saved from another', async () => {
    store.addTemplate('forest');
    await sync.start();
    // Another browser, with nothing of its own yet
    localStorage.clear();
    setUp();
    await sync.start();
    expect(store.maps().map((m) => [m.name, m.blocks.map((b) => b.name)])).toEqual([[FIRST_MAP, ['Forest']]]);
    expect(server.maps.size).toBe(1);
  });

  it('takes in what another device changed, and says so when it is the open map', async () => {
    store.addTemplate('forest');
    await sync.start();
    const [saved] = server.maps.values();
    server.maps.set(saved.id, { ...saved, name: 'Family', version: saved.version + 1 });
    server.revision++;
    await sync.pull();
    expect(store.map().name).toBe('Family');
    expect(snackBar.open).toHaveBeenCalledWith('“Family” was changed on another device.', 'OK', expect.anything());
  });

  it('keeps the change made here when another device saved first, and says so', async () => {
    store.addTemplate('forest');
    await sync.start();
    const [saved] = server.maps.values();
    // Another device saves a new version that this browser has not seen
    server.maps.set(saved.id, { ...saved, name: 'Theirs', version: saved.version + 1 });
    store.renameMap(saved.id, 'Mine');
    await settle();
    expect(server.maps.get(saved.id)).toMatchObject({ name: 'Mine', version: saved.version + 2 });
    expect(snackBar.open).toHaveBeenCalledWith('“Mine” was also changed on another device. The changes made here were kept.', 'OK', expect.anything());
    expect(sync.status()).toBe('saved');
  });

  it('keeps changes while the server cannot be reached, and saves them when it can', async () => {
    await sync.start();
    server.down = true;
    store.addTemplate('forest');
    await settle();
    expect(sync.status()).toBe('offline');
    expect(JSON.parse(localStorage.getItem('boligmaskinen.prototype.v4')!).maps[0].blocks).toHaveLength(1);
    server.down = false;
    await wait(60);
    await settle();
    expect(sync.status()).toBe('saved');
    expect([...server.maps.values()][0].blocks.map((b) => b.name)).toEqual(['Forest']);
  });
});
