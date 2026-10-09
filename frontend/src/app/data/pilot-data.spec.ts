import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DATA_BASE, packBase, PilotData } from './pilot-data';

describe('the data pack', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is read from the pack its meta.json names, so a pack switched in meanwhile does not mix with it', () => {
    expect(packBase({ pack: '20261010T043000Z-run42' })).toBe(new URL('data-packs/20261010T043000Z-run42/', document.baseURI).href);
    expect(packBase({})).toBe(DATA_BASE);
  });

  it('asks for meta.json from the current pack every time, and for the layers from the pack it names', async () => {
    const requested: { url: string; cache?: RequestCache }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      requested.push({ url, cache: init?.cache });
      if (url.endsWith('meta.json')) {
        return new Response(JSON.stringify({ pack: 'p1', width: 1, height: 1, files: { mask: 'mask.png' }, municipalities: [] }));
      }
      return new Response('not a container', { status: 404 });
    }));
    const data = TestBed.inject(PilotData);
    await data.load();
    expect(requested[0]).toEqual({ url: `${DATA_BASE}data/meta.json`, cache: 'no-cache' });
    expect(requested[1].url).toBe(new URL('data-packs/p1/data/mask.png', document.baseURI).href);
    expect(data.state()).toBe('error');
  });
});
