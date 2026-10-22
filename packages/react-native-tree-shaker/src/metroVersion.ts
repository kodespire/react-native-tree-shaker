import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Metro versions tested with scripts/test-metro-versions.mjs: React Native
 * 0.79 (Metro 0.82) through 0.88 (Metro 0.87). 0.82 added the
 * `metro/private/*` exports this package loads.
 */
export const SUPPORTED_METRO_RANGE = { min: '0.82.0', maxExclusive: '0.88.0' } as const;

/** Returns a warning message when the app's Metro is outside the supported range. */
export function checkMetroVersion(projectRoot: string): string | null {
  let version: string;
  try {
    const appRequire = createRequire(path.join(projectRoot, 'package.json'));
    version = appRequire('metro/package.json').version;
  } catch {
    return `Could not resolve metro from ${projectRoot}. Is it installed?`;
  }

  if (compareVersions(version, SUPPORTED_METRO_RANGE.min) < 0 || compareVersions(version, SUPPORTED_METRO_RANGE.maxExclusive) >= 0) {
    return `Metro ${version} is outside the supported range (>=${SUPPORTED_METRO_RANGE.min} <${SUPPORTED_METRO_RANGE.maxExclusive}). Bundles may be wrong.`;
  }
  return null;
}

export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function parse(version: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = version
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  return [major, minor, patch];
}
