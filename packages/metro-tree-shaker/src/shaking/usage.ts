import { analyzeModule, readsAll, type DependencyInfo, type InteropHelper, type ModuleAnalysis } from '../analysis/analyzeModule';

/** The parts of a Metro module the shaker works with. */
export interface ShakeModule {
  path: string;
  code: string;
  /** In dependency-map order. `path` is null for unresolved optional dependencies. */
  dependencies: ReadonlyArray<{ path: string | null; async: boolean }>;
}

export const ALL = 'all' as const;
export type Usage = Set<string> | typeof ALL;

export type Facts = ModuleAnalysis | { error: string };
export const failed = (facts: Facts): facts is { error: string } => 'error' in facts;

const INTEROP_HELPER = /[\\/]@babel[\\/]runtime[\\/]helpers[\\/](?:esm[\\/])?(interopRequireDefault|interopRequireWildcard)\.js$/;
// `Object.defineProperty(e,"__esModule",...)` or `e.__esModule=!0`, but not interop helpers' `t.__esModule` reads.
const ES_MODULE_MARKER = /defineProperty\(\s*[\w$.]+\s*,\s*["']__esModule["']|\.__esModule\s*=\s*(?:!0|true)/;

/** Whether each module marks itself `__esModule`, from a cheap scan of its code. */
export function esModuleFlags(modules: ReadonlyMap<string, ShakeModule>): Map<string, boolean> {
  return new Map([...modules].map(([p, m]) => [p, ES_MODULE_MARKER.test(m.code)]));
}

/** What the analysis needs to know about each of a module's dependencies. */
export function dependencyInfos(module: ShakeModule, esModule: ReadonlyMap<string, boolean>): DependencyInfo[] {
  return module.dependencies.map((d) => {
    if (!d.path) return {};
    const helper = d.path.match(INTEROP_HELPER)?.[1] as InteropHelper | undefined;
    return helper ? { helper } : { esModule: esModule.get(d.path) };
  });
}

export function analyze(module: ShakeModule, esModule: ReadonlyMap<string, boolean>): Facts {
  try {
    return analyzeModule(module.code, dependencyInfos(module, esModule));
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Which exports of each module are read anywhere in the graph. Roots, async
 * imports, modules that can't be analyzed and reads that can't be followed
 * make every export used. Aliases (`module.exports = require(x)`, possibly
 * several targets chosen at runtime) and
 * `export *` pass their importers' reads through.
 */
export function computeUsage(
  modules: ReadonlyMap<string, ShakeModule>,
  facts: ReadonlyMap<string, Facts>,
  roots: Iterable<string>,
): Map<string, Usage> {
  const used = new Map<string, Usage>();
  const use = (target: string, names: Usage): boolean => {
    const current = used.get(target);
    if (current === ALL) return false;
    if (names === ALL) {
      used.set(target, ALL);
      return true;
    }
    const set = current ?? new Set<string>();
    const before = set.size;
    for (const n of names) set.add(n);
    used.set(target, set);
    return current === undefined || set.size !== before;
  };

  for (const root of roots) use(root, ALL);
  for (const [path, module] of modules) {
    const f = facts.get(path)!;
    module.dependencies.forEach((dependency, index) => {
      if (!dependency.path) return;
      if (dependency.async || failed(f)) return void use(dependency.path, ALL);
      const reads = f.reads.get(index);
      if (reads === undefined) return;
      use(dependency.path, readsAll(reads) ? ALL : reads);
    });
  }

  // Aliases and `export *` forward their own usage; repeat until stable.
  for (let changed = true; changed; ) {
    changed = false;
    for (const [path, module] of modules) {
      const f = facts.get(path)!;
      if (failed(f)) continue;
      const usage = used.get(path) ?? new Set<string>();
      for (const alias of f.aliases) {
        const target = module.dependencies[alias]?.path;
        if (target && use(target, usage)) changed = true;
      }
      for (const star of f.stars) {
        const target = module.dependencies[star]?.path;
        if (!target) continue;
        // Names this module defines itself shadow the star export.
        const own = f.exports.kind === 'static' ? f.exports.names : new Set<string>();
        const forwarded: Usage = usage === ALL ? ALL : new Set([...usage].filter((n) => n !== 'default' && !own.has(n)));
        if (use(target, forwarded)) changed = true;
      }
    }
  }
  return used;
}
