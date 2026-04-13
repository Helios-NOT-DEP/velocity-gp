import { readFileSync } from 'node:fs';

interface ApiPackageJson {
  readonly version?: string;
}

const FALLBACK_API_VERSION = '0.0.0';

function readApiVersionFromPackageJson(): string {
  try {
    const packageJsonUrl = new URL('../../package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as ApiPackageJson;

    if (typeof packageJson.version === 'string' && packageJson.version.length > 0) {
      return packageJson.version;
    }
  } catch {
    // Fallback keeps probes and logs available even if package.json is inaccessible.
  }

  return FALLBACK_API_VERSION;
}

export const buildInfo = Object.freeze({
  version: readApiVersionFromPackageJson(),
});
