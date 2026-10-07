/**
 * Which version is running, named like the OCI image labels (org.opencontainers.image.version,
 * .revision, .source, .created). The image sets APP_REVISION, APP_SOURCE and APP_CREATED when CI
 * builds it from master, and the release workflow adds APP_VERSION to the same image.
 */
export interface BuildInfo {
  /** Release tag, e.g. "v1.2.0"; empty for builds that are not a release. */
  version: string;
  /** Commit hash. */
  revision: string;
  /** Repository URL. */
  source: string;
  /** When the image was built. */
  created: string;
}

/** The version from the environment, or null when it says nothing, as in a local run. */
export function versionFromEnv(env: NodeJS.ProcessEnv): BuildInfo | null {
  const info: BuildInfo = {
    version: env['APP_VERSION'] ?? '',
    revision: env['APP_REVISION'] ?? '',
    source: env['APP_SOURCE'] ?? '',
    created: env['APP_CREATED'] ?? '',
  };
  return info.version || info.revision ? info : null;
}
