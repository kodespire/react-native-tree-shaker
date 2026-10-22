// Analysis-only report of general tree shaking potential for an app: which
// exports are read anywhere, which modules' exports can't be analyzed (and
// why), and which modules no one reads at all. Writes JSON to $OUT and stops
// the build. Wraps the app's metro.config.js from the current directory.
//
//   OUT=potential.json npx react-native bundle --config <this file> --entry-file index.js --platform ios --dev false --minify true
const fs = require('node:fs');
const path = require('node:path');
const { analyze, computeUsage, esModuleFlags, failed, ALL } = require('../../packages/metro-tree-shaker/dist/shaking/usage.js');
const { createSideEffectsCheck } = require('../../packages/metro-tree-shaker/dist/shaking/sideEffects.js');

const exported = require(path.join(process.cwd(), 'metro.config.js'));

function report(graph, options) {
  const started = Date.now();
  const modules = new Map();
  for (const m of graph.dependencies.values()) {
    const output = m.output.find((o) => o.type.startsWith('js/'));
    if (!output) continue;
    modules.set(m.path, {
      path: m.path,
      code: output.data.code,
      dependencies: [...m.dependencies.values()].map((d) => ({ path: d.absolutePath ?? null, async: d.data?.data?.asyncType != null })),
    });
  }
  const roots = [...graph.entryPoints, ...options.runBeforeMainModule].filter((p) => modules.has(p));
  const esModule = esModuleFlags(modules);
  const facts = new Map([...modules].map(([p, m]) => [p, analyze(m, esModule)]));
  const analyzedMs = Date.now() - started;
  const used = computeUsage(modules, facts, roots);
  const sideEffects = createSideEffectsCheck();

  const bytes = (p) => Buffer.byteLength(modules.get(p).code);
  const rel = (p) => path.relative(process.cwd(), p);
  const group = () => new Map();
  const add = (map, key, p) => {
    const g = map.get(key) ?? { modules: 0, bytes: 0, examples: [] };
    g.modules++;
    g.bytes += bytes(p);
    if (g.examples.length < 3) g.examples.push(rel(p));
    map.set(key, g);
  };
  const sorted = (map) => [...map].sort((a, b) => b[1].bytes - a[1].bytes).map(([reason, g]) => ({ reason, ...g }));

  const totals = { modules: modules.size, bytes: 0, static: { modules: 0, bytes: 0 }, pinned: { modules: 0, bytes: 0 }, failed: { modules: 0, bytes: 0 } };
  const pinnedReasons = group();
  const allReasons = group();
  let unusedNames = 0;
  let partlyUnused = { modules: 0, bytes: 0 };
  let unread = { removable: { modules: 0, bytes: 0, byPackage: {} }, withSideEffects: { modules: 0, bytes: 0 } };
  const readAllTargets = new Set();
  const examples = [];

  for (const [p, f] of facts) {
    const b = bytes(p);
    totals.bytes += b;
    if (failed(f)) {
      totals.failed.modules++;
      totals.failed.bytes += b;
      continue;
    }
    const kind = f.exports.kind === 'static' ? 'static' : 'pinned';
    totals[kind].modules++;
    totals[kind].bytes += b;
    if (kind === 'pinned') add(pinnedReasons, f.exports.reason.replace(/ [\w$]+$/, ' …'), p);
    for (const [index, r] of f.reads) {
      const target = modules.get(p).dependencies[index]?.path;
      if (r instanceof Set || !target || readAllTargets.has(target)) continue;
      // Only reads that cost something: the target's exports could otherwise be shaken.
      const targetFacts = facts.get(target);
      if (!targetFacts || failed(targetFacts) || targetFacts.exports.kind !== 'static' || targetFacts.exports.names.size === 0) continue;
      readAllTargets.add(target);
      add(allReasons, r.all, target);
      const code = modules.get(p).code;
      const at = code.search(new RegExp(`\\b[\\w$]+\\[${index}\\]`));
      examples.push({ reason: r.all, importer: rel(p), target: rel(target), snippet: code.slice(Math.max(0, at - 90), at + 70) });
    }

    const usage = used.get(p);
    if (usage === ALL) continue;
    if (kind === 'static' && f.exports.names.size > 0) {
      const unused = [...f.exports.names].filter((n) => !usage?.has(n));
      unusedNames += unused.length;
      if (unused.length > 0 && usage && usage.size > 0) {
        partlyUnused.modules++;
        partlyUnused.bytes += b;
      }
    }
    if (!usage || usage.size === 0) {
      // Required only for side effects, if at all.
      if (sideEffects(p)) {
        unread.withSideEffects.modules++;
        unread.withSideEffects.bytes += b;
      } else {
        unread.removable.modules++;
        unread.removable.bytes += b;
        const pkg = rel(p).match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1] ?? '(app)';
        unread.removable.byPackage[pkg] = (unread.removable.byPackage[pkg] ?? 0) + b;
      }
    }
  }
  // Per package: how much is shakeable and how much is unused.
  const packages = {};
  for (const [p, f] of facts) {
    const name = rel(p).match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1] ?? '(app)';
    const s = (packages[name] ??= { bytes: 0, static: 0, pinned: 0, partlyUnused: 0, noUsedExports: 0, unusedNames: 0 });
    const b = bytes(p);
    s.bytes += b;
    if (failed(f)) continue;
    if (f.exports.kind !== 'static') { s.pinned += b; continue; }
    s.static += b;
    const usage = used.get(p);
    if (usage === ALL) continue;
    const unused = [...f.exports.names].filter((n) => !usage?.has(n)).length;
    s.unusedNames += unused;
    if (f.exports.names.size > 0 && (!usage || usage.size === 0)) s.noUsedExports += b;
    else if (unused > 0) s.partlyUnused += b;
  }
  unread.removable.byPackage = Object.fromEntries(Object.entries(unread.removable.byPackage).sort((a, b) => b[1] - a[1]).slice(0, 15));

  return {
    analyzedMs,
    totals,
    unusedExportNames: unusedNames,
    partlyUnusedModules: partlyUnused,
    unreadModules: unread,
    pinnedReasons: sorted(pinnedReasons).slice(0, 15),
    readAllReasons: sorted(allReasons).slice(0, 15),
    readAllExamples: examples,
    packages,
  };
}

module.exports = async (defaults) => {
  const base = await (typeof exported === 'function' ? exported(defaults) : exported);
  return {
    ...base,
    serializer: {
      ...base.serializer,
      customSerializer: async (entryPoint, preModules, graph, options) => {
        fs.writeFileSync(process.env.OUT, JSON.stringify(report(graph, options), null, 2) + '\n');
        process.exit(0);
      },
    },
  };
};
