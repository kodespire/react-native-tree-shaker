import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import type { InputConfigT } from 'metro-config';
import { describe, expect, it, vi } from 'vitest';
import { bundleSourceMap, loadMetroDefaultSerializer, type CustomSerializer } from '../src/serializer';
import { withTreeShaking } from '../src/withTreeShaking';
import { fixturesDir, getDefaultConfig, mergeConfig, metroRuntimeDir, runBuild } from './metroUnderTest';

interface Expected {
  phase: number;
  entry: string;
  modules: { kept: string[]; removed: string[] };
  output?: string[];
}

const phase1 = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => ({ name: e.name, expected: JSON.parse(readFileSync(path.join(fixturesDir, e.name, 'expected.json'), 'utf8')) as Expected }))
  .filter(({ expected }) => expected.phase === 1);

async function build(fixture: string, wrap: (config: InputConfigT) => InputConfigT = (c) => c) {
  const base = mergeConfig(await getDefaultConfig(fixture), {
    projectRoot: fixture,
    watchFolders: [fixture, metroRuntimeDir],
    cacheStores: [],
    reporter: { update() {} },
    transformer: {
      getTransformOptions: async () => ({ transform: { experimentalImportSupport: true, inlineRequires: true } }),
    },
  });
  return runBuild(wrap(base) as typeof base, { entry: './index.js', platform: 'ios', dev: false, minify: true, sourceMap: true });
}

/** Files the bundle's source map covers, relative to the fixture. */
function shippedFiles(fixture: string, map: string): string[] {
  const collect = (m: any): string[] => (m.sections ? m.sections.flatMap((s: any) => collect(s.map)) : m.sources);
  return collect(JSON.parse(map)).map((s) => (path.isAbsolute(s) ? path.relative(fixture, s) : s));
}

/** Runs a bundle the way a JS engine would and returns what it logged. */
function run(code: string): string[] {
  const output: string[] = [];
  vm.runInContext(code, vm.createContext({ console: { log: (...args: unknown[]) => output.push(args.join(' ')) } }));
  return output;
}

describe.each(phase1)('fixture $name', ({ name, expected }) => {
  const fixture = path.join(fixturesDir, name);

  it('ships exactly the expected modules and still runs', async () => {
    const result = await build(fixture, (c) => withTreeShaking(c, { quiet: true }));
    const shipped = shippedFiles(fixture, result.map);
    for (const file of expected.modules.kept) expect(shipped, `${file} should ship`).toContain(file);
    for (const file of expected.modules.removed) expect(shipped, `${file} should be removed`).not.toContain(file);
    expect(run(result.code)).toEqual(expected.output ?? []);
  }, 60_000);
});

describe('react-native getter shaking', () => {
  const fixture = path.join(fixturesDir, 'react-native-getters');

  it('removes nothing without the wrapper', async () => {
    const result = await build(fixture);
    expect(shippedFiles(fixture, result.map)).toContain('node_modules/react-native/Libraries/ToastAndroid.js');
  }, 60_000);

  it('prints a one-line summary', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await build(fixture, (c) => withTreeShaking(c));
    expect(log).toHaveBeenCalledWith('[react-native-tree-shaker] react-native getters: 1 of 2 read; removed 1 modules (0.1 KiB).');
    log.mockRestore();
  }, 60_000);

  it('builds the same source map Metro builds itself', async () => {
    let captured: Parameters<CustomSerializer> | undefined;
    const result = await build(fixture, (c) => ({
      ...c,
      serializer: {
        ...c.serializer,
        customSerializer: async (...args: Parameters<CustomSerializer>) => {
          captured = args;
          return loadMetroDefaultSerializer(fixture)(...args);
        },
      },
    }));
    const [, preModules, graph, options] = captured!;
    expect(await bundleSourceMap(fixture, preModules, graph, options)).toBe(result.map);
  }, 60_000);
});
