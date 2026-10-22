import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import { analyzeModule, readsAll, type DependencyInfo, type InteropHelper } from '../analysis/analyzeModule';
import { dependencyIndex, factoryOf, literalKey, Param, paramBinding, UnsupportedCodeError } from '../analysis/metroModule';

export { UnsupportedCodeError };
export type { InteropHelper };

export interface EntryShape {
  /** Getter name → indices into the entry module's dependency map that only that getter's body requires. */
  getters: Map<string, Set<number>>;
  /** Dependency indices required outside any getter, or never referenced at all. Always kept. */
  alwaysFollowed: Set<number>;
}

/**
 * Reads the getter object out of react-native's entry module, in Metro's
 * transformed output: `m.exports = { get View() { return r(d[13]).default }, ... }`.
 */
export function analyzeEntry(code: string, dependencyCount: number): EntryShape {
  const factory = factoryOf(code);
  const getters = new Map<string, Set<number>>();
  const referenced = new Set<number>();
  const alwaysFollowed = new Set<number>();

  factory.traverse({
    ObjectMethod(path) {
      if (path.node.kind === 'get') getters.set(keyName(path.node), getters.get(keyName(path.node)) ?? new Set());
    },
  });

  for (const ref of paramBinding(factory, Param.DependencyMap)?.referencePaths ?? []) {
    const index = dependencyIndex(ref);
    if (index === 'paths') continue;
    if (index === undefined) throw new UnsupportedCodeError('react-native/index.js uses its dependency map dynamically');
    referenced.add(index);
    const getter = ref.findParent((p) => p.isObjectMethod() && p.node.kind === 'get') as NodePath<t.ObjectMethod> | null;
    if (getter) getters.get(keyName(getter.node))!.add(index);
    else alwaysFollowed.add(index);
  }

  for (let i = 0; i < dependencyCount; i++) {
    if (!referenced.has(i)) alwaysFollowed.add(i);
  }
  // A dependency required both inside and outside getters is always needed.
  for (const indices of getters.values()) {
    for (const i of alwaysFollowed) indices.delete(i);
  }
  return { getters, alwaysFollowed };
}

export type Reads =
  /** `reexports`: the module sets `module.exports` to react-native's exports object, so its importers read react-native. */
  | { kind: 'names'; names: Set<string>; reexports: boolean }
  | { kind: 'all'; reason: string };

/**
 * Which properties of react-native's entry object one module reads, given the
 * indices of its dependency map that point at the entry, and those that point
 * at Babel's interop helpers in `@babel/runtime`. Anything the analysis can't
 * follow (spread, computed keys, passing the object around, importAll, which
 * copies every property) reads everything.
 */
export function analyzeReads(
  code: string,
  entryIndices: ReadonlySet<number>,
  helperIndices: ReadonlyMap<number, InteropHelper> = new Map(),
): Reads {
  const count = Math.max(-1, ...entryIndices, ...helperIndices.keys()) + 1;
  // react-native's entry is a CommonJS module: no `__esModule`.
  const dependencies: DependencyInfo[] = Array.from({ length: count }, (_, i) =>
    entryIndices.has(i) ? { esModule: false } : { helper: helperIndices.get(i) },
  );
  const analysis = analyzeModule(code, dependencies);
  const names = new Set<string>();
  for (const index of entryIndices) {
    const reads = analysis.reads.get(index);
    if (readsAll(reads)) return { kind: 'all', reason: reads.all };
    for (const name of reads ?? []) names.add(name);
    if (analysis.stars.has(index)) return { kind: 'all', reason: "re-exports react-native with export *" };
  }
  return { kind: 'names', names, reexports: [...analysis.aliases].some((i) => entryIndices.has(i)) };
}

function keyName(method: t.ObjectMethod): string {
  const name = !method.computed && method.key.type === 'Identifier' ? method.key.name : literalKey(method.key);
  if (name === undefined) throw new UnsupportedCodeError('react-native/index.js has a getter with a computed name');
  return name;
}
