import { readsAll } from '../analysis/analyzeModule';
import { editModule, type Edits } from './edit';
import { editedSourceName, type Finisher, type JsOutputData } from './finish';
import { ALL, analyze, computeUsage, dependencyInfos, esModuleFlags, failed, type Facts, type ShakeModule, type Usage } from './usage';

export interface InputModule extends ShakeModule {
  /** The original file, for source maps. */
  source: string;
  data: JsOutputData;
}

export interface ShakeOptions {
  roots: Iterable<string>;
  hasSideEffects: (file: string) => boolean;
  finish: Finisher;
  maxRounds?: number;
}

export interface ShakeResult {
  /** New output for every module that was rewritten and kept. */
  outputs: Map<string, JsOutputData>;
  /** Modules nothing requires anymore. */
  removed: Set<string>;
  removedExports: number;
  rounds: number;
  /** Modules whose exports couldn't be analyzed, so none could be removed. */
  pinned: Array<{ path: string; reason: string }>;
  /**
   * Modules in the graph that no module's code requires, as Metro built it
   * (for example when the minifier removed the only require). Kept as they are.
   */
  unreferenced: string[];
  /** Set when shaking was abandoned; nothing should be changed. */
  failure?: string;
}

const CONCURRENCY = 16;

/**
 * Removes exports nothing reads, then the code and modules only they needed,
 * from a graph of Metro module outputs. Repeats until a round changes nothing,
 * because removing code can leave more exports unread.
 */
export async function shakeExports(modules: ReadonlyMap<string, InputModule>, options: ShakeOptions): Promise<ShakeResult> {
  const current = new Map(modules);
  const esModule = esModuleFlags(current);
  const facts = new Map<string, Facts>([...current].map(([p, m]) => [p, analyze(m, esModule)]));
  const originalFacts = new Map(facts);
  const result: ShakeResult = { outputs: new Map(), removed: new Set(), removedExports: 0, rounds: 0, pinned: [], unreferenced: [] };
  for (const [p, f] of facts) {
    if (!failed(f) && f.exports.kind === 'pinned') result.pinned.push({ path: p, reason: f.exports.reason });
  }

  // Modules no code requires stay exactly as Metro built them, like roots.
  const given = [...options.roots].filter((p) => modules.has(p));
  const reachable = live(current, facts, given);
  result.unreferenced = [...current.keys()].filter((p) => !reachable.has(p));
  const roots = [...given, ...result.unreferenced];

  const unchanged = new Set<string>(); // module + edits signatures that produced no change
  const maxRounds = options.maxRounds ?? 10;
  while (result.rounds < maxRounds) {
    const used = computeUsage(current, facts, roots);
    const plans: Array<{ path: string; edits: Edits; signature: string }> = [];
    const provides = (path: string, name: string) => mayDefine(current, facts, path, name);
    for (const [p, m] of current) {
      const edits = plan(m, facts.get(p)!, used.get(p), options.hasSideEffects, provides);
      if (!edits) continue;
      const signature = `${p}|${[...edits.removeExports].sort()}|${[...edits.dropStars].sort()}|${[...edits.dropRequires].sort()}`;
      if (!unchanged.has(signature)) plans.push({ path: p, edits, signature });
    }
    if (plans.length === 0) break;
    result.rounds++;

    for (let i = 0; i < plans.length; i += CONCURRENCY) {
      await Promise.all(
        plans.slice(i, i + CONCURRENCY).map(async ({ path, edits, signature }) => {
          const m = current.get(path)!;
          const edited = editModule(m.code, editedSourceName(path), dependencyInfos(m, esModule), edits);
          if (!edited) {
            unchanged.add(signature);
            return;
          }
          const data = await options.finish({ path, source: m.source, data: m.data }, edited);
          const before = facts.get(path)!;
          const updated = { ...m, code: data.code, data };
          current.set(path, updated);
          const after = analyze(updated, esModule);
          facts.set(path, after);
          if (!failed(before) && before.exports.kind === 'static' && !failed(after) && after.exports.kind === 'static') {
            result.removedExports += before.exports.names.size - after.exports.names.size;
          }
        }),
      );
    }
  }

  const reached = live(current, facts, roots);
  for (const p of current.keys()) if (!reached.has(p)) result.removed.add(p);
  for (const [p, m] of current) {
    if (m !== modules.get(p) && reached.has(p)) result.outputs.set(p, m.data);
  }

  const problem = selfCheck(current, facts, originalFacts, reached);
  return problem ? { ...result, outputs: new Map(), removed: new Set(), failure: problem } : result;
}

/** The edits one module needs this round, or null. */
function plan(
  m: ShakeModule,
  f: Facts,
  usage: Usage | undefined,
  hasSideEffects: (file: string) => boolean,
  provides: (path: string, name: string) => boolean,
): Edits | null {
  if (failed(f)) return null;
  // Every export of a root or a module read in full stays, but its own unused imports can still go.
  const removeExports = new Set(f.exports.kind === 'static' && usage !== ALL ? [...f.exports.names].filter((n) => !usage?.has(n)) : []);

  const own = f.exports.kind === 'static' ? f.exports.names : new Set<string>();
  const forwarded = usage === ALL ? [] : [...(usage ?? [])].filter((n) => n !== 'default' && !own.has(n));
  // `export *` loops that copy none of the names read through this module.
  // A module with pinned exports may read its own star exports, so it keeps them.
  const dropStars = new Set<number>();
  if (f.exports.kind === 'static' && usage !== ALL) {
    for (const star of f.stars) {
      const target = m.dependencies[star]?.path;
      if (forwarded.length === 0 || (target && !forwarded.some((n) => provides(target, n)))) dropStars.add(star);
    }
  }

  const dropRequires = new Set<number>();
  for (const [index, reads] of f.reads) {
    const target = m.dependencies[index]?.path;
    if (!target || readsAll(reads) || reads.size > 0 || f.aliases.has(index)) continue;
    if (f.stars.has(index) && !dropStars.has(index)) continue;
    if (!hasSideEffects(target)) dropRequires.add(index);
  }

  if (removeExports.size === 0 && dropStars.size === 0 && dropRequires.size === 0) return null;
  const dependencyHasSideEffects = (index: number) => {
    const target = m.dependencies[index]?.path;
    return !target || hasSideEffects(target);
  };
  return { removeExports, dropStars, dropRequires, hasSideEffects: dependencyHasSideEffects };
}

/** Modules reachable from the roots through requires the code still makes (plus async imports, aliases and export *). */
function live(modules: ReadonlyMap<string, ShakeModule>, facts: ReadonlyMap<string, Facts>, roots: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (seen.has(p) || !modules.has(p)) continue;
    seen.add(p);
    const f = facts.get(p)!;
    modules.get(p)!.dependencies.forEach((d, index) => {
      if (!d.path) return;
      if (failed(f) || d.async || f.reads.has(index) || f.stars.has(index) || f.aliases.has(index)) stack.push(d.path);
    });
  }
  return seen;
}

/**
 * After shaking: no kept module requires a removed one, and every name a kept
 * module reads from a dependency is still defined there if it was before.
 */
function selfCheck(
  modules: ReadonlyMap<string, ShakeModule>,
  facts: ReadonlyMap<string, Facts>,
  originalFacts: ReadonlyMap<string, Facts>,
  kept: ReadonlySet<string>,
): string | undefined {
  const defines = (factsOf: ReadonlyMap<string, Facts>, path: string, name: string) => mayDefine(modules, factsOf, path, name);
  for (const p of kept) {
    const f = facts.get(p)!;
    if (failed(f)) continue;
    const m = modules.get(p)!;
    for (const [index, reads] of f.reads) {
      const target = m.dependencies[index]?.path;
      if (!target || !modules.has(target)) continue;
      if (!kept.has(target)) return `${p} still requires ${target}, which was removed`;
      if (readsAll(reads)) continue;
      for (const name of reads) {
        if (defines(originalFacts, target, name) && !defines(facts, target, name)) return `${p} reads ${name} from ${target}, which was removed`;
      }
    }
  }
  return undefined;
}

/**
 * Whether a module may export a name, itself or through `export *`. True
 * when its exports can't be listed.
 */
function mayDefine(
  modules: ReadonlyMap<string, ShakeModule>,
  facts: ReadonlyMap<string, Facts>,
  path: string,
  name: string,
  seen = new Set<string>(),
): boolean {
  const f = facts.get(path);
  if (!f || failed(f) || f.exports.kind === 'pinned' || f.exports.names.has(name)) return true;
  if (seen.has(path)) return false;
  seen.add(path);
  const m = modules.get(path)!;
  return [...f.stars].some((s) => {
    const target = m.dependencies[s]?.path;
    return !target || mayDefine(modules, facts, target, name, seen);
  });
}
