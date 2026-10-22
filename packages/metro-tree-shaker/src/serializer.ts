import { createRequire } from 'node:module';
import path from 'node:path';
import type { ConfigT } from 'metro-config';
import { findDevelopmentCode } from '@metro-tree-shaker/shake-report';
import type { SideEffectsField } from '@metro-tree-shaker/side-effects-db';
import { planGetterShaking, type GetterShakingPlan, type GraphModule } from './reactNative/plan';
import { createFinisher, type JsOutputData, type MinifierSettings } from './shaking/finish';
import { shakeExports, type InputModule, type ShakeResult } from './shaking/shake';
import { createSideEffectsCheck } from './shaking/sideEffects';

export type CustomSerializer = NonNullable<ConfigT['serializer']['customSerializer']>;

type SerializerArgs = Parameters<CustomSerializer>;
type Graph = SerializerArgs[2];
type SerializerOptions = SerializerArgs[3];
type Module = Graph['dependencies'] extends ReadonlyMap<string, infer M> ? M : never;

export interface TreeShakingSerializerOptions {
  /** The serializer that was configured before ours, if any. */
  original: CustomSerializer | null;
  /** Used to load Metro's own serializer and source map code from the app's copy of Metro. */
  projectRoot: string;
  enabled: boolean;
  /** react-native getters to keep even when no read of them is found. */
  keepReactNativeGetters?: readonly string[];
  /** Remove unused exports (general tree shaking). Defaults to true. */
  shakeExports?: boolean;
  /** `sideEffects` per package, overriding package.json and the curated database. */
  sideEffects?: Record<string, SideEffectsField>;
  /** The app's minifier, to re-minify modules that changed. Required for `shakeExports`. */
  minifier?: Omit<MinifierSettings, 'minify'>;
  /** Report what was removed or why shaking was skipped. Defaults to printing one line. */
  log?: (message: string) => void;
}

export function createTreeShakingSerializer({
  original,
  projectRoot,
  enabled,
  keepReactNativeGetters = [],
  shakeExports: exportsEnabled = true,
  sideEffects,
  minifier,
  log = (message) => console.log(message),
}: TreeShakingSerializerOptions): CustomSerializer {
  let fallback: CustomSerializer | undefined;
  const next = (...args: SerializerArgs) => {
    const serialize = original ?? (fallback ??= loadMetroDefaultSerializer(projectRoot));
    return serialize(...args);
  };

  return async (entryPoint, preModules, graph, options) => {
    if (options.dev || !enabled) {
      return next(entryPoint, preModules, graph, options);
    }
    warnAboutDevelopmentCode(graph, log);
    if (options.unstable_inlineDependencyMap || options.dependencyMapReservedName != null) {
      log('[metro-tree-shaker] Skipped: unstable_inlineDependencyMap and dependencyMapReservedName are not supported.');
      return next(entryPoint, preModules, graph, options);
    }
    const roots = [...graph.entryPoints, ...options.runBeforeMainModule];

    // Phase 1: getters on react-native's entry that nothing reads.
    let dependencies: Map<string, Module> = new Map(graph.dependencies);
    try {
      const plan = planGetterShaking(graph.dependencies as unknown as ReadonlyMap<string, GraphModule>, roots, keepReactNativeGetters);
      if (plan) log(describe(plan, projectRoot));
      if (plan) for (const p of plan.removed) dependencies.delete(p);
    } catch (error) {
      // Never fail a build over an optimization.
      log(`[metro-tree-shaker] react-native getters: skipped, kept everything. Unexpected error: ${(error as Error).message}`);
    }

    // Phase 3: exports nothing reads, and the code and modules only they needed.
    if (exportsEnabled && minifier) {
      try {
        const started = performance.now();
        const shaken = await shakeGraphExports(dependencies, roots, {
          projectRoot,
          sideEffects,
          minifier: { ...minifier, minify: graph.transformOptions.minify },
        });
        if ('skipped' in shaken) {
          log(`[metro-tree-shaker] exports: skipped, kept everything. ${shaken.skipped}.`);
        } else {
          log(describeExports(shaken.result, shaken.removedBytes, shaken.beforeBytes, (performance.now() - started) / 1000));
          if (!shaken.result.failure) dependencies = shaken.dependencies;
        }
      } catch (error) {
        log(`[metro-tree-shaker] exports: skipped, kept everything. Unexpected error: ${(error as Error).message}`);
      }
    }

    if (dependencies.size === graph.dependencies.size && [...dependencies].every(([p, m]) => graph.dependencies.get(p) === m)) {
      return next(entryPoint, preModules, graph, options);
    }
    const shaken = withDependencies(graph, dependencies);
    const result = await next(entryPoint, preModules, shaken, options);
    if (typeof result !== 'string') return result;
    // Metro would otherwise build the map from the unshaken graph.
    return { code: result, map: await bundleSourceMap(projectRoot, preModules, shaken, options) };
  };
}

const jsOutput = (m: Module) => m.output.find((o) => o.type.startsWith('js/'));

async function shakeGraphExports(
  dependencies: Map<string, Module>,
  roots: string[],
  settings: { projectRoot: string; sideEffects?: Record<string, SideEffectsField>; minifier: MinifierSettings },
): Promise<{ result: ShakeResult; dependencies: Map<string, Module>; removedBytes: number; beforeBytes: number } | { skipped: string }> {
  const inputs = new Map<string, InputModule>();
  for (const [p, m] of dependencies) {
    const output = jsOutput(m);
    if (!output) continue;
    const data = output.data as unknown as JsOutputData;
    inputs.set(p, {
      path: p,
      code: data.code,
      source: m.getSource().toString(),
      data,
      dependencies: [...m.dependencies.values()].map((d: any) => ({ path: d.absolutePath ?? null, async: d.data?.data?.asyncType != null })),
    });
  }
  // Expo's tree shaking hands over modules it hasn't finished transforming.
  const unwrapped = [...inputs.values()].filter((m) => !/^\s*(?:[\w$]+)?__d\(/.test(m.code)).length;
  if (unwrapped > 0) {
    return { skipped: `${unwrapped} modules aren't Metro module definitions yet, as when Expo's own tree shaking is on` };
  }

  const result = await shakeExports(inputs, {
    roots,
    hasSideEffects: createSideEffectsCheck(settings.sideEffects),
    finish: createFinisher(settings.projectRoot, settings.minifier),
  });
  const bytes = (code: string) => Buffer.byteLength(code);
  const beforeBytes = [...inputs.values()].reduce((sum, m) => sum + bytes(m.code), 0);
  let afterBytes = 0;
  const shaken = new Map<string, Module>();
  for (const [p, m] of dependencies) {
    if (result.removed.has(p)) continue;
    const data = result.outputs.get(p);
    shaken.set(p, data ? ({ ...m, output: m.output.map((o) => (o.type.startsWith('js/') ? { ...o, data: data as any } : o)) } as Module) : m);
    afterBytes += bytes((data ?? inputs.get(p)?.data)?.code ?? '');
  }
  return { result, dependencies: shaken, removedBytes: beforeBytes - afterBytes, beforeBytes };
}

function describeExports(result: ShakeResult, removedBytes: number, beforeBytes: number, seconds: number): string {
  if (result.failure) return `[metro-tree-shaker] exports: skipped, kept everything. ${result.failure}.`;
  return (
    `[metro-tree-shaker] exports: removed ${result.removedExports} unused exports and ${result.removed.size} modules, ` +
    `${(removedBytes / 1024).toFixed(1)} KiB (${((removedBytes / beforeBytes) * 100).toFixed(1)}% of module code), in ${result.rounds} rounds, ${seconds.toFixed(1)} s. ` +
    `${result.pinned.length} modules' exports couldn't be analyzed.` +
    (result.unreferenced.length > 0 ? ` ${result.unreferenced.length} modules no code requires were kept as they are.` : '')
  );
}

function warnAboutDevelopmentCode(graph: Graph, log: (message: string) => void) {
  const found = findDevelopmentCode([...graph.dependencies.values()].map((m) => ({ path: m.path, bytes: Buffer.byteLength((jsOutput(m)?.data as any)?.code ?? '') })));
  if (found.length === 0) return;
  const list = found.map((d) => `${d.label} (${(d.bytes / 1024).toFixed(1)} KiB)`).join(', ');
  log(
    `[metro-tree-shaker] Warning: this production bundle contains development-only code: ${list}. ` +
      'Usually process.env.NODE_ENV isn\'t inlined, for example when Expo\'s Metro config is used without babel-preset-expo.',
  );
}

const MAX_LISTED_BLOCKERS = 20;

function describe(plan: GetterShakingPlan, projectRoot: string): string {
  if (plan.skipped) {
    const blockers = plan.skipped.map(({ file, reason }) => `${path.relative(projectRoot, file)} ${reason}.`);
    if (blockers.length === 1) return `[metro-tree-shaker] react-native getters: skipped, kept everything. ${blockers[0]}`;
    return [
      `[metro-tree-shaker] react-native getters: skipped, kept everything. ${blockers.length} files use react-native in ways the analysis can't follow:`,
      ...blockers.slice(0, MAX_LISTED_BLOCKERS).map((b) => `  ${b}`),
      ...(blockers.length > MAX_LISTED_BLOCKERS ? [`  ...and ${blockers.length - MAX_LISTED_BLOCKERS} more.`] : []),
    ].join('\n');
  }
  return (
    `[metro-tree-shaker] react-native getters: ${plan.keptGetters.length} of ${plan.getterCount} read; ` +
    `removed ${plan.removed.size} modules (${(plan.removedBytes / 1024).toFixed(1)} KiB).`
  );
}

/** The same graph object, with `dependencies` replaced. Methods still work. */
function withDependencies(graph: Graph, dependencies: Graph['dependencies']): Graph {
  return new Proxy(graph, {
    get: (target, prop, receiver) => (prop === 'dependencies' ? dependencies : Reflect.get(target, prop, receiver)),
  });
}

/**
 * The bundle source map Metro builds after serializing (`Server.js`:
 * `sourceMapStringNonBlocking([...prepend, ...sortedModules])`), for a given graph.
 * Production CLI builds don't set `excludeSource`, so sources are included.
 */
export async function bundleSourceMap(
  projectRoot: string,
  preModules: SerializerArgs[1],
  graph: Graph,
  options: SerializerOptions,
): Promise<string> {
  const appRequire = createRequire(path.join(projectRoot, 'package.json'));
  const { sourceMapStringNonBlocking } = appRequire('metro/private/DeltaBundler/Serializers/sourceMapString');
  const modules = [...graph.dependencies.values()];
  modules.sort((a, b) => options.createModuleId(a.path) - options.createModuleId(b.path));
  return sourceMapStringNonBlocking([...preModules, ...modules], {
    excludeSource: false,
    processModuleFilter: options.processModuleFilter,
    shouldAddToIgnoreList: options.shouldAddToIgnoreList,
    getSourceUrl: options.getSourceUrl,
  });
}

/**
 * Metro's own serialization when no custom serializer is configured
 * (`Server.js`: `bundleToString(baseJSBundle(...)).code`).
 */
export function loadMetroDefaultSerializer(projectRoot: string): CustomSerializer {
  const appRequire = createRequire(path.join(projectRoot, 'package.json'));
  const baseJSBundle = interopDefault(appRequire('metro/private/DeltaBundler/Serializers/baseJSBundle'));
  const bundleToString = interopDefault(appRequire('metro/private/lib/bundleToString'));

  return async (entryPoint, preModules, graph, options) =>
    bundleToString(baseJSBundle(entryPoint, preModules, graph, options)).code;
}

function interopDefault(mod: any) {
  return mod && mod.__esModule ? mod.default : mod;
}
