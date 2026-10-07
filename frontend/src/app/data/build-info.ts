import { Injectable, computed, signal } from '@angular/core';

/**
 * Which version of the app is running, named like the OCI image labels
 * (org.opencontainers.image.version, .revision, .source, .created).
 *
 * The backend serves it from the container at api/version. The image build puts the same
 * values in its labels and in the environment, which the backend reads. Without a backend,
 * as on the artifact host, the file tools/build-info.mjs writes into the build is used.
 */
export interface BuildInfo {
  /** Release tag, e.g. "v1.2.0"; empty for builds that are not a release. */
  version: string;
  /** Commit hash. */
  revision: string;
  /** Repository URL. */
  source: string;
  /** When the image or bundle was built. */
  created: string;
}

export interface VersionLabel {
  /** The release tag, the short commit hash, or "local build". */
  text: string;
  /** The repository, when it is known. */
  url: string | null;
  title: string;
}

export function versionLabel(info: BuildInfo | null): VersionLabel {
  const short = info?.revision.slice(0, 7) ?? '';
  const text = info?.version || short || 'local build';
  if (!info) return { text, url: null, title: 'Built locally, not from git' };
  const url = info.source || null;
  const what = info.version ? `Release ${info.version}` : info.revision ? `Commit ${short}` : 'Built locally, not from git';
  return { text, url, title: `${what}${info.created ? ` · built ${info.created.slice(0, 10)}` : ''}` };
}

/** JSON from a path next to the app, or null when it is missing or not JSON (e.g. a dev server's index page). */
async function json<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(new URL(path, document.baseURI));
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class BuildInfoService {
  readonly info = signal<BuildInfo | null>(null);
  readonly label = computed(() => versionLabel(this.info()));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.info.set((await json<BuildInfo>('api/version')) ?? (await json<BuildInfo>('build-info.json')));
  }
}
