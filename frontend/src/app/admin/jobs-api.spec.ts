import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobsApi, JobsApiError } from './jobs-api';

const answer = (status: number, body: string, type = 'application/json') => async () => new Response(body, { status, headers: { 'content-type': type } });

describe('JobsApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the jobs', async () => {
    vi.stubGlobal('fetch', vi.fn(answer(200, '{"jobs":[],"runs":[]}')));
    expect(await TestBed.inject(JobsApi).list()).toEqual({ jobs: [], runs: [] });
  });

  it('tells a missing backend from a backend that refuses', async () => {
    const api = TestBed.inject(JobsApi);
    vi.stubGlobal('fetch', vi.fn(answer(200, '<app-root></app-root>', 'text/html')));
    await expect(api.list()).rejects.toMatchObject({ noBackend: true });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api.list()).rejects.toMatchObject({ noBackend: true, message: 'The backend cannot be reached' });
    vi.stubGlobal('fetch', vi.fn(answer(409, '{"statusCode":409,"error":"Conflict","message":"Quick is switched off"}')));
    const refused = await api.run('quick').catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(JobsApiError);
    expect(refused).toMatchObject({ noBackend: false, message: 'Quick is switched off' });
  });

  it('sends the switch as JSON', async () => {
    const fetch = vi.fn(answer(200, '{"job":{"id":"quick","enabled":false}}'));
    vi.stubGlobal('fetch', fetch);
    expect(await TestBed.inject(JobsApi).setEnabled('quick', false)).toEqual({ id: 'quick', enabled: false });
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe('/api/jobs/quick');
    expect(init).toMatchObject({ method: 'PATCH', body: '{"enabled":false}', headers: { 'content-type': 'application/json' } });
  });
});
