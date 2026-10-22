import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

/**
 * The Metro the e2e tests build with. By default the repo's own; set
 * METRO_COMPAT_DIR to a directory with another Metro version installed
 * (see scripts/test-metro-versions.mjs, which also copies the fixtures there
 * so that metro-tree-shaker, which loads Metro from the project root, finds
 * that copy).
 */
export const metroRoot = process.env.METRO_COMPAT_DIR ? path.resolve(process.env.METRO_COMPAT_DIR) : repoRoot;

const metroRequire = createRequire(path.join(metroRoot, 'package.json'));
export const { runBuild } = metroRequire('metro') as typeof import('metro');
export const { getDefaultConfig, mergeConfig } = metroRequire('metro-config') as typeof import('metro-config');
export const metroVersion: string = metroRequire('metro/package.json').version;
export const metroRuntimeDir = path.dirname(metroRequire.resolve('metro-runtime/package.json'));

export const fixturesDir = path.join(metroRoot, 'fixtures');
if (!existsSync(fixturesDir)) {
  throw new Error(`No fixtures in ${metroRoot}. Run scripts/test-metro-versions.mjs, which copies them there.`);
}
