import { Injectable, computed, inject, signal } from '@angular/core';
import { I18n, TextParams } from '../i18n/i18n';

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

/** The version in words, in the language `t` translates to. */
export function versionLabel(info: BuildInfo | null, t: (key: string, params?: TextParams) => string): VersionLabel {
  const short = info?.revision.slice(0, 7) ?? '';
  const text = info?.version || short || t('version.local');
  if (!info) return { text, url: null, title: t('version.localTitle') };
  const url = info.source || null;
  const what = info.version ? t('version.release', { version: info.version }) : info.revision ? t('version.commit', { commit: short }) : t('version.localTitle');
  return { text, url, title: info.created ? t('version.built', { what, date: info.created.slice(0, 10) }) : what };
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
  private readonly i18n = inject(I18n);
  readonly label = computed(() => versionLabel(this.info(), (key, params) => this.i18n.t(key, params)));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.info.set((await json<BuildInfo>('api/version')) ?? (await json<BuildInfo>('build-info.json')));
  }
}
