import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { loadMetroDefaultSerializer, type CustomSerializer } from '../src/serializer';
import { withTreeShaking } from '../src/withTreeShaking';
import { fixturesDir, getDefaultConfig, mergeConfig, metroRuntimeDir, runBuild } from './metroUnderTest';

interface Outcome {
  modules: { kept: string[]; removed: string[] };
  exports: Record<string, { kept: string[]; removed: string[] }>;
  output?: string[];
}

interface Expected extends Outcome {
  phase: number;
  entry: string;
  overrides?: Record<string, Partial<Outcome>>;
}

const phase3 = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => ({ name: e.name, expected: JSON.parse(readFileSync(path.join(fixturesDir, e.name, 'expected.json'), 'utf8')) as Expected }))
  .filter(({ expected }) => expected.phase === 3);

// The two shapes ESM takes in Metro's transform output: Metro's own
// import/export lowering, and Babel's CommonJS transform, which is what
// React Native apps get from @react-native/babel-preset.
const dialects = [
  { id: 'metro', dialect: 'Metro import support', experimentalImportSupport: true, babelTransformerPath: undefined },
  {
    id: 'babel',
    dialect: 'Babel CommonJS',
    experimentalImportSupport: false,
    babelTransformerPath: createRequire(__filename).resolve('@react-native/metro-babel-transformer'),
  },
];
const variants = dialects.flatMap((d) => [true, false].map((inlineRequires) => ({ ...d, inlineRequires })));
const babelRuntimeDir = path.dirname(createRequire(__filename).resolve('@babel/runtime/package.json'));

type Variant = (typeof variants)[number];
type Captured = { graph: Parameters<CustomSerializer>[2]; options: Parameters<CustomSerializer>[3] };

async function build(fixture: string, variant: Variant, shake: boolean) {
  let captured: Captured | undefined;
  const serializeAndCapture: CustomSerializer = (entryPoint, preModules, graph, options) => {
    captured = { graph, options };
    return loadMetroDefaultSerializer(fixture)(entryPoint, preModules, graph, options);
  };
  const base = mergeConfig(await getDefaultConfig(fixture), {
    projectRoot: fixture,
    watchFolders: [fixture, metroRuntimeDir, babelRuntimeDir],
    cacheStores: [],
    reporter: { update() {} },
    serializer: { customSerializer: serializeAndCapture },
    transformer: {
      ...(variant.babelTransformerPath && { babelTransformerPath: variant.babelTransformerPath }),
      getTransformOptions: async () => ({
        transform: { experimentalImportSupport: variant.experimentalImportSupport, inlineRequires: variant.inlineRequires },
      }),
    },
  });
  const config = shake ? withTreeShaking(base, { quiet: true }) : base;
  const result = await runBuild(config, { entry: './index.js', platform: 'ios', dev: false, minify: true, sourceMap: true });
  return { ...result, ...captured! };
}

/** Files the bundle's source map covers, relative to the fixture. */
function shippedFiles(fixture: string, map: string): string[] {
  const collect = (m: any): string[] => (m.sections ? m.sections.flatMap((s: any) => collect(s.map)) : m.sources);
  return collect(JSON.parse(map)).map((s) => (path.isAbsolute(s) ? path.relative(fixture, s) : s));
}

/**
 * Runs a bundle the way a JS engine would. Returns what it logged, and the
 * export names of the given modules, read by requiring them afterwards.
 */
function run(code: string, inspect: Array<{ file: string; id: number }> = []) {
  const output: string[] = [];
  const context = vm.createContext({ console: { log: (...args: unknown[]) => output.push(args.join(' ')) } });
  vm.runInContext('Math.random = () => 0.75;', context);
  vm.runInContext(code, context);
  const exports: Record<string, string[]> = {};
  for (const { file, id } of inspect) exports[file] = Object.keys(context.__r(id)).sort();
  return { output, exports };
}

describe.each(phase3)('fixture $name', ({ name, expected: base }) => {
  const fixture = path.join(fixturesDir, name);

  it.each(variants)('$dialect, inlineRequires $inlineRequires', async (variant) => {
    const expected: Outcome = { ...base, ...base.overrides?.[`${variant.id}${variant.inlineRequires ? '+inlineRequires' : ''}`] };
    const [plain, shaken] = await Promise.all([build(fixture, variant, false), build(fixture, variant, true)]);
    // With inlineRequires, Metro itself drops imports whose bindings are never
    // used, so some modules are missing before shaking. Expectations apply to
    // what plain Metro ships.
    const inGraph = (b: typeof plain, file: string) => b.graph.dependencies.has(path.join(fixture, file));
    const inspect = (b: typeof plain) =>
      Object.keys(expected.exports)
        .filter((file) => inGraph(b, file))
        .map((file) => ({ file, id: b.options.createModuleId(path.join(fixture, file)) }));
    const before = run(plain.code, inspect(plain));
    const after = run(shaken.code, inspect(shaken));

    if (!variant.inlineRequires) {
      // The case is meaningful: plain Metro ships everything expected to go.
      const plainFiles = shippedFiles(fixture, plain.map);
      for (const file of expected.modules.removed) expect(plainFiles, `plain Metro ships ${file}`).toContain(file);
      for (const [file, { removed }] of Object.entries(expected.exports)) {
        for (const n of removed) expect(before.exports[file], `plain Metro exports ${n} from ${file}`).toContain(n);
      }
    }

    const keptModules = expected.modules.kept.filter((file) => inGraph(plain, file));
    const shipped = shippedFiles(fixture, shaken.map);
    for (const file of keptModules) expect(shipped, `${file} should ship`).toContain(file);
    for (const file of expected.modules.removed) expect(shipped, `${file} should be removed`).not.toContain(file);
    const local = (b: typeof plain) => [...b.graph.dependencies.keys()].map((p) => path.relative(fixture, p)).filter((p) => !p.startsWith('..'));
    expect(local(shaken).sort()).toEqual([...keptModules].sort());
    for (const [file, { kept, removed }] of Object.entries(expected.exports)) {
      if (!inGraph(plain, file)) continue;
      for (const n of kept) expect(after.exports[file], `${file} should keep ${n}`).toContain(n);
      for (const n of removed) expect(after.exports[file], `${file} should drop ${n}`).not.toContain(n);
    }

    expect(after.output).toEqual(before.output);
    if (expected.output) expect(after.output).toEqual(expected.output);
  }, 60_000);
});
