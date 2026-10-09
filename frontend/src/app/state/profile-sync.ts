import { DestroyRef, effect, inject, Injectable, InjectionToken, signal, untracked } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SavedMap } from '@boligmaskinen/engine';
import { ProfileApi, ProfileApiError } from './profile-api';
import { Store } from './store';
import { afterConflicts, afterSave, changesSince, merge, SyncNotice } from './sync';

/**
 * - loading: asking the server for the first time.
 * - local: nothing here keeps maps (no backend, or one without a database), so they stay in this browser.
 * - saved: the server has everything.
 * - saving: changes are on their way.
 * - offline: the server cannot be reached; changes are kept here and saved when it can.
 */
export type SyncStatus = 'loading' | 'local' | 'saved' | 'saving' | 'offline';

export interface SyncTiming {
  /** How long after the last change it is saved, so a slider sends one save, not a hundred. */
  saveAfterMs: number;
  /** How often an open page asks for changes from other devices. */
  pollMs: number;
  /** How long to wait before trying an unreachable server again. */
  retryMs: number;
}

export const SYNC_TIMING = new InjectionToken<SyncTiming>('SYNC_TIMING', {
  factory: () => ({ saveAfterMs: 800, pollMs: 30_000, retryMs: 30_000 }),
});

/** At most this many saves in a row: changes made during a save, and conflicts, call for another. */
const MAX_ROUNDS = 5;

/**
 * Keeps the user's maps and places on the server, so every browser has them (the profile API).
 * The store keeps working on its own copy, also kept in localStorage: this saves its changes a
 * moment after they are made, and takes in what other devices saved when the page is shown again
 * and every half minute. Where they meet, the change made here wins, and the user is told.
 */
@Injectable({ providedIn: 'root' })
export class ProfileSync {
  private readonly store = inject(Store);
  private readonly api = inject(ProfileApi);
  private readonly snackBar = inject(MatSnackBar);
  private readonly timing = inject(SYNC_TIMING);
  readonly status = signal<SyncStatus>('loading');

  private started = false;
  private loaded = false;
  private etag: string | null = null;
  /** Server calls run one at a time, in order. */
  private queue: Promise<void> = Promise.resolve();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') void this.pull();
    else if (this.saveTimer) {
      // The page may be closed now: send what waits, in a request that outlives it
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      void this.enqueue(() => this.save(true));
    }
  };

  constructor() {
    effect(() => {
      this.store.maps();
      this.store.places();
      untracked(() => this.changed());
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Load from the server, then keep it up to date (the app starts this). */
  start(): Promise<void> {
    if (this.started) return this.queue;
    this.started = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.pull();
    }, this.timing.pollMs);
    return this.pull();
  }

  /** Take in what other devices saved, then save what is new here. */
  pull(): Promise<void> {
    return this.enqueue(async () => {
      if (this.status() === 'local') return;
      let answer: Awaited<ReturnType<ProfileApi['load']>>;
      try {
        answer = await this.api.load(this.etag);
      } catch (error) {
        return this.failed(error);
      }
      if (answer !== 'unchanged') {
        this.etag = answer.etag;
        const open = this.store.map();
        const merged = merge({ maps: this.store.maps(), places: this.store.places() }, this.store.synced(), answer.profile);
        this.store.replaceAll({ maps: merged.maps, places: merged.places, synced: merged.base });
        this.tell(merged.notices, open, !this.loaded);
      }
      this.loaded = true;
      await this.save();
    });
  }

  private stop(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    for (const timer of [this.saveTimer, this.retryTimer]) if (timer) clearTimeout(timer);
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task, task);
    return this.queue;
  }

  /** The maps or places changed here: save them shortly. */
  private changed(): void {
    if (!this.loaded || this.status() === 'local') return;
    if (!changesSince(this.store.maps(), this.store.places(), this.store.synced()).length) return;
    if (this.status() !== 'offline') this.status.set('saving');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.enqueue(() => this.save());
    }, this.timing.saveAfterMs);
  }

  private async save(keepalive = false): Promise<void> {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const pending = changesSince(this.store.maps(), this.store.places(), this.store.synced());
      if (!pending.length) {
        this.status.set('saved');
        return;
      }
      this.status.set('saving');
      let answer: Awaited<ReturnType<ProfileApi['save']>>;
      try {
        answer = await this.api.save(pending.map((p) => p.change), keepalive);
      } catch (error) {
        return this.failed(error);
      }
      if ('conflicts' in answer) {
        // Another device got there first: save again from its versions, so the changes made here win
        this.store.synced.set(afterConflicts(this.store.synced(), answer.conflicts));
        const names = answer.conflicts.map((c) => (c.kind === 'map' ? this.store.maps() : this.store.places()).find((item) => item.id === c.id)?.name);
        this.tell(names.filter((name): name is string => !!name).map((name) => ({ type: 'conflict', name })), this.store.map(), false);
      } else {
        this.store.synced.set(afterSave(this.store.synced(), pending, answer));
      }
    }
  }

  private failed(error: unknown): void {
    // Nothing here keeps maps, and this browser never saved to a server: it keeps them itself
    if (error instanceof ProfileApiError && error.noBackend && !this.loaded && !this.store.synced().epoch) {
      this.status.set('local');
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
      return;
    }
    this.status.set('offline');
    this.retryTimer ??= setTimeout(() => {
      this.retryTimer = null;
      void this.pull();
    }, this.timing.retryMs);
  }

  private tell(notices: SyncNotice[], open: SavedMap, first: boolean): void {
    const lines: string[] = [];
    for (const notice of notices) {
      if (notice.type === 'conflict') lines.push(`“${notice.name}” was also changed on another device. The changes made here were kept.`);
      else if (notice.type === 'renamed') lines.push(`“${notice.name}” from this browser is now “${notice.to}”, next to the one already saved.`);
      // Changes from other devices are only news for the map that is open
      else if (!first && notice.kind === 'map' && notice.id === open.id) {
        lines.push(notice.type === 'updated' ? `“${notice.name}” was changed on another device.` : `“${notice.name}” was deleted on another device.`);
      }
    }
    if (lines.length) this.snackBar.open(lines.join(' '), 'OK', { duration: 8000 });
  }
}
