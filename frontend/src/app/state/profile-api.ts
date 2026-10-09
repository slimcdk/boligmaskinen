import { Injectable } from '@angular/core';
import { ProfileChange, Profile, ProfileConflicts, ProfileSaved } from '@boligmaskinen/engine';

/**
 * Why a call to the profile API failed. `noBackend`: nothing here keeps maps, such as a static host,
 * the dev server without a backend, or a backend without a database. Otherwise the server could not
 * be reached or failed, and asking again later may work.
 */
export class ProfileApiError extends Error {
  readonly noBackend: boolean;

  constructor(message: string, noBackend: boolean) {
    super(message);
    this.name = 'ProfileApiError';
    this.noBackend = noBackend;
  }
}

/** The backend's saved maps and places (backend/src/routes/profile.ts). */
@Injectable({ providedIn: 'root' })
export class ProfileApi {
  /** The profile, or 'unchanged' when it still has the ETag given. */
  async load(etag: string | null): Promise<{ profile: Profile; etag: string | null } | 'unchanged'> {
    const response = await this.fetch('api/profile', { headers: etag ? { 'if-none-match': etag } : undefined, cache: 'no-store' });
    if (response.status === 304) return 'unchanged';
    const profile = await this.json<Profile>(response);
    return { profile, etag: response.headers.get('etag') };
  }

  /** Save changes. With `keepalive` the request outlives the page, for when it is being closed. */
  async save(changes: ProfileChange[], keepalive = false): Promise<ProfileSaved | ProfileConflicts> {
    const response = await this.fetch('api/profile/changes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ changes }), keepalive,
    });
    if (response.status === 409) return this.json<ProfileConflicts>(response, true);
    return this.json<ProfileSaved>(response);
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(new URL(path, document.baseURI), init);
    } catch {
      throw new ProfileApiError('The server cannot be reached', false);
    }
  }

  private async json<T>(response: Response, conflict = false): Promise<T> {
    const json = response.headers.get('content-type')?.includes('json') ? await response.json().catch(() => null) : null;
    // A page instead of JSON is a host without the API; 404 a backend from before it; 503 one without a database
    if (!json || response.status === 404) throw new ProfileApiError(`No saved maps here (HTTP ${response.status})`, true);
    if (response.status === 503) throw new ProfileApiError((json as { message?: string }).message ?? 'No database', true);
    if (!response.ok && !conflict) throw new ProfileApiError((json as { message?: string }).message ?? `HTTP ${response.status}`, false);
    return json as T;
  }
}
