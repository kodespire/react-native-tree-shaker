import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { withTreeShaking, type TreeShakingOptions } from '../src/withTreeShaking';
import { fixturesDir, getDefaultConfig, mergeConfig, metroRuntimeDir, runBuild } from './metroUnderTest';

const fixture = path.join(fixturesDir, 'unused-named-export');

async function build(wrap: boolean, options: TreeShakingOptions = {}): Promise<{ code: string; map: string }> {
  const base = mergeConfig(await getDefaultConfig(fixture), {
    projectRoot: fixture,
    watchFolders: [fixture, metroRuntimeDir],
    cacheStores: [],
    reporter: { update() {} },
    transformer: {
      getTransformOptions: async () => ({ transform: { experimentalImportSupport: true, inlineRequires: false } }),
    },
  });
  const config = wrap ? withTreeShaking(base, { quiet: true, ...options }) : base;
  return runBuild(config, { entry: './index.js', platform: 'ios', dev: false, minify: false, sourceMap: true });
}

describe('withTreeShaking in a real Metro build', () => {
  it('removes an unused export and the bundle still runs the same', async () => {
    const [plain, wrapped] = await Promise.all([build(false), build(true)]);
    // The problem this project exists to fix: Metro ships the unused export.
    expect(plain.code).toContain('function unused(');
    expect(wrapped.code).not.toContain('unused');
    expect(run(wrapped.code)).toEqual(run(plain.code));
    expect(run(wrapped.code)).toEqual(['2']);
  }, 60_000);

  it('is a strict pass-through with shaking disabled', async () => {
    const [plain, off] = await Promise.all([build(false), build(true, { enabled: false })]);
    expect(off.code).toBe(plain.code);
    expect(off.map).toBe(plain.map);
  }, 60_000);
});

/** Runs a bundle the way a JS engine would and returns what it logged. */
function run(code: string): string[] {
  const output: string[] = [];
  vm.runInContext(code, vm.createContext({ console: { log: (...args: unknown[]) => output.push(args.join(' ')) } }));
  return output;
}
