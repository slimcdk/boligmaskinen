import { Injectable } from '@angular/core';
import { loadByteContainer } from '../data/byte-container';
import { ROUTED_MODES, RoutedTimes } from './travel';

/** What POST /api/travel answers (backend/src/pipeline/travel.ts). */
interface TravelState {
  id: string;
  state: 'ready' | 'working' | 'failed' | 'unavailable';
  message?: string;
}

/** How often to ask while the server finds them, and for how long: a night's build can hold it up. */
const POLL_MS = 1_500;
const GIVE_UP_MS = 10 * 60_000;

/**
 * Travel times to a place on the road network, which the server finds (POST /api/travel). Until
 * they come, and where there is no server that finds them, the map estimates them from the distance.
 */
@Injectable({ providedIn: 'root' })
export class TravelService {
  private readonly asked = new Map<string, Promise<RoutedTimes | null>>();
  /** Waits between asks; the tests make it short. */
  pollMs = POLL_MS;
  /** Loads a layer; the tests have their own. */
  load: (url: string) => Promise<Uint8Array> = loadByteContainer;

  /** The travel times to a position on the data pack `pack`, or null when they are estimated. */
  times(pack: string, lng: number, lat: number): Promise<RoutedTimes | null> {
    const key = `${pack}|${lng.toFixed(5)},${lat.toFixed(5)}`;
    let times = this.asked.get(key);
    if (!times) {
      times = this.find(lng, lat)
        .catch((error: unknown) => {
          console.warn('Could not get the travel times, so they are estimated', error);
          return null;
        })
        .then((found) => {
          // Asked again next time: the road network may be built by then
          if (!found) this.asked.delete(key);
          return found;
        });
      this.asked.set(key, times);
    }
    return times;
  }

  private async find(lng: number, lat: number): Promise<RoutedTimes | null> {
    const end = Date.now() + GIVE_UP_MS;
    for (;;) {
      const state = await this.ask(lng, lat);
      if (!state || state.state === 'unavailable' || state.state === 'failed') return null;
      if (state.state === 'ready') {
        const layers = await Promise.all(ROUTED_MODES.map((mode) => this.load(new URL(`api/travel/${state.id}/${mode}`, document.baseURI).href)));
        return Object.fromEntries(ROUTED_MODES.map((mode, i) => [mode, layers[i]])) as RoutedTimes;
      }
      if (Date.now() > end) return null;
      await new Promise((resolve) => setTimeout(resolve, this.pollMs));
    }
  }

  /** The server's answer, or null when there is no server that finds travel times. */
  private async ask(lng: number, lat: number): Promise<TravelState | null> {
    const response = await fetch(new URL('api/travel', document.baseURI), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lng, lat }), cache: 'no-store',
    });
    // A host without the API answers with a page, or 404
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return null;
    return (await response.json()) as TravelState;
  }
}
