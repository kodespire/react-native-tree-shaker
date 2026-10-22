import { analyzeEntry, analyzeReads, UnsupportedCodeError, type InteropHelper } from './analyze';

/** The parts of Metro's module graph this needs (see metro/private/DeltaBundler/types). */
export interface GraphModule {
  path: string;
  dependencies: ReadonlyMap<string, { absolutePath?: string | null }>;
  output: ReadonlyArray<{ type: string; data: { code: string } }>;
}

export interface GetterShakingPlan {
  /** Absolute path of react-native/index.js. */
  entry: string;
  getterCount: number;
  /** Getters some kept module reads, plus any the user asked to keep. */
  keptGetters: string[];
  /** Modules reachable only through getters nobody reads. */
  removed: Set<string>;
  removedBytes: number;
  /** Set when shaking was skipped (nothing is removed): every file that blocked it, and why. */
  skipped?: Array<{ file: string; reason: string }>;
}

const ENTRY = /[\\/]node_modules[\\/]react-native[\\/]index\.js$/;
const INTEROP_HELPER = /[\\/]@babel[\\/]runtime[\\/]helpers[\\/](?:esm[\\/])?(interopRequireDefault|interopRequireWildcard)\.js$/;

/**
 * Works out which modules are reachable only through getters on
 * react-native's entry object that no kept module reads. Returns null when
 * react-native isn't in the graph.
 */
export function planGetterShaking(
  modules: ReadonlyMap<string, GraphModule>,
  roots: Iterable<string>,
  keepGetters: Iterable<string> = [],
): GetterShakingPlan | null {
  const entry = [...modules.keys()].find((p) => ENTRY.test(p));
  if (!entry) return null;
  const entryModule = modules.get(entry)!;

  const skip = (blockers: Array<{ file: string; reason: string }>): GetterShakingPlan => ({
    entry,
    getterCount: 0,
    keptGetters: [],
    removed: new Set(),
    removedBytes: 0,
    skipped: blockers,
  });

  const entryCode = jsCode(entryModule);
  if (entryCode === undefined) return skip([{ file: entry, reason: 'has no JS module output' }]);
  const targets = [...entryModule.dependencies.values()].map((d) => d.absolutePath ?? null);

  let shape;
  try {
    shape = analyzeEntry(entryCode, targets.length);
  } catch (error) {
    const reason = error instanceof UnsupportedCodeError ? error.message : `could not be analyzed: ${(error as Error).message}`;
    return skip([{ file: entry, reason }]);
  }
  const getterTargets = new Map([...shape.getters].map(([name, indices]) => [name, pathsAt(targets, indices)]));
  const alwaysFollowed = pathsAt(targets, shape.alwaysFollowed);
  const rootList = [...roots].filter((p) => modules.has(p));

  const reach = (getters: Iterable<string>) => {
    const seen = new Set<string>();
    const stack = [...rootList];
    while (stack.length > 0) {
      const path = stack.pop()!;
      if (seen.has(path) || !modules.has(path)) continue;
      seen.add(path);
      if (path === entry) {
        stack.push(...alwaysFollowed);
        for (const g of getters) stack.push(...(getterTargets.get(g) ?? []));
      } else {
        for (const d of modules.get(path)!.dependencies.values()) if (d.absolutePath) stack.push(d.absolutePath);
      }
    }
    return seen;
  };

  if (reach(getterTargets.keys()).size !== modules.size) {
    return skip([{ file: entry, reason: 'some modules are not reachable from the entry points, so removal could not be checked' }]);
  }

  // react-native's entry, plus modules that re-export it (`module.exports = require('react-native')`).
  const aliases = new Set([entry]);

  /** The getters one module reads, or why its reads can't be followed. */
  const readsOf = (path: string): { names: Set<string>; reexports: boolean } | { blocked: string } | null => {
    const module = modules.get(path)!;
    const entryIndices = new Set(
      [...module.dependencies.values()].flatMap((d, i) => (d.absolutePath && aliases.has(d.absolutePath) ? [i] : [])),
    );
    if (path === entry || entryIndices.size === 0) return null;
    const code = jsCode(module);
    if (code === undefined) return { blocked: 'imports react-native but has no JS module output' };
    const helperIndices = new Map(
      [...module.dependencies.values()].flatMap((d, i) => {
        const helper = d.absolutePath?.match(INTEROP_HELPER)?.[1] as InteropHelper | undefined;
        return helper ? [[i, helper] as const] : [];
      }),
    );
    try {
      const reads = analyzeReads(code, entryIndices, helperIndices);
      return reads.kind === 'all' ? { blocked: reads.reason } : { names: reads.names, reexports: reads.reexports };
    } catch (error) {
      return { blocked: `could not be analyzed: ${(error as Error).message}` };
    }
  };

  /** Once one file blocks shaking everything is kept, so list every blocker in the bundle at once. */
  const allBlockers = () =>
    [...modules.keys()]
      .sort()
      .flatMap((path) => {
        const reads = readsOf(path);
        return reads && 'blocked' in reads ? [{ file: path, reason: reads.blocked }] : [];
      });

  // Grow the set of read getters until it stops changing: code behind a read
  // getter can itself read more getters.
  const kept = new Set([...keepGetters].filter((g) => getterTargets.has(g)));
  const scanned = new Set<string>();
  let reachable = reach(kept);
  for (;;) {
    let changed = false;
    for (const path of reachable) {
      if (scanned.has(path)) continue;
      scanned.add(path);
      const reads = readsOf(path);
      if (!reads) continue;
      if ('blocked' in reads) return skip(allBlockers());
      if (reads.reexports && !aliases.has(path)) {
        // Its importers may already have been scanned without counting it; scan everything again.
        aliases.add(path);
        scanned.clear();
        changed = true;
      }
      for (const name of reads.names) {
        if (getterTargets.has(name) && !kept.has(name)) {
          kept.add(name);
          changed = true;
        }
      }
    }
    if (!changed) break;
    reachable = reach(kept);
  }

  const removed = new Set([...modules.keys()].filter((p) => !reachable.has(p)));
  return {
    entry,
    getterCount: getterTargets.size,
    keptGetters: [...kept].sort(),
    removed,
    removedBytes: [...removed].reduce((sum, p) => sum + Buffer.byteLength(jsCode(modules.get(p)!) ?? ''), 0),
  };
}

function jsCode(module: GraphModule): string | undefined {
  return module.output.find((o) => o.type.startsWith('js/module'))?.data.code;
}

function pathsAt(targets: ReadonlyArray<string | null>, indices: Iterable<number>): string[] {
  return [...indices].flatMap((i) => (targets[i] ? [targets[i]!] : []));
}
