import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TravelService } from './travel.service';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('travel times from the server', () => {
  let answers: Response[];
  let fetches: { url: string; body: string }[];

  beforeEach(() => {
    answers = [];
    fetches = [];
    vi.stubGlobal('fetch', vi.fn(async (url: URL | string, init?: RequestInit) => {
      fetches.push({ url: String(url), body: String(init?.body) });
      return answers.shift() ?? json({ id: '', state: 'unavailable' });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const service = () => {
    const travel = TestBed.inject(TravelService);
    travel.pollMs = 1;
    travel.load = async (url) => Uint8Array.of({ car: 12, bike: 34, walk: 56, transit: 78 }[url.split('/').pop()!]!);
    return travel;
  };
  const first = (times: Record<string, Uint8Array> | null) => times && Object.fromEntries(Object.entries(times).map(([mode, layer]) => [mode, layer[0]]));

  it('asks until they are ready, then loads every mode the server found them by', async () => {
    answers.push(json({ id: 'abc', state: 'working' }), json({ id: 'abc', state: 'ready', modes: ['car', 'bike', 'walk', 'transit'] }));
    expect(first(await service().times('pack-1', 10.2039, 56.15))).toEqual({ car: 12, bike: 34, walk: 56, transit: 78 });
    expect(fetches.map((f) => f.body)).toEqual(['{"lng":10.2039,"lat":56.15}', '{"lng":10.2039,"lat":56.15}']);
  });

  it('loads the road modes from a server that names none, and leaves public transport to the estimate', async () => {
    answers.push(json({ id: 'abc', state: 'ready' }));
    expect(first(await service().times('pack-1', 10.2039, 56.15))).toEqual({ car: 12, bike: 34, walk: 56 });
  });

  it('asks once for the same place on the same pack', async () => {
    answers.push(json({ id: 'abc', state: 'ready' }));
    const travel = service();
    const [one, two] = await Promise.all([travel.times('pack-1', 10.2, 56.1), travel.times('pack-1', 10.200001, 56.1)]);
    expect(one).toBe(two);
    expect(fetches).toHaveLength(1);
  });

  it('leaves them to the estimates when the server cannot find them, and asks again later', async () => {
    const travel = service();
    answers.push(json({ id: '', state: 'unavailable', message: 'The road network is not built yet' }));
    expect(await travel.times('pack-1', 10.2, 56.1)).toBeNull();
    // A host without the API
    answers.push(new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    expect(await travel.times('pack-1', 10.2, 56.1)).toBeNull();
    answers.push(json({ id: 'x', state: 'failed', message: 'There is no road near' }));
    expect(await travel.times('pack-1', 10.2, 56.1)).toBeNull();
    expect(fetches).toHaveLength(3);
  });
});
