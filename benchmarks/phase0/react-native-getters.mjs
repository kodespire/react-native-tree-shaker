// Estimates how much of a production bundle is reachable only through
// getters on react-native's entry object (`get View() { return require(...) }`).
// Getters are lazy, so modules behind getters nobody reads never run; they
// only cost bundle size. Expo's shaker and other ESM shakers leave them in.
//
// Usage: node react-native-getters.mjs <graph.json> [--json <out.json>]
// The graph comes from capture-graph.metro.config.cjs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parse as babelParse } from '@babel/parser';

const [graphPath, flag, jsonOut] = process.argv.slice(2);
const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
const byPath = new Map(graph.modules.map((m) => [m.path, m]));
const rnIndex = graph.modules.find((m) => m.path.endsWith('/node_modules/react-native/index.js'));
if (!rnIndex) throw new Error('react-native/index.js is not in the graph');

// --- Parsing helpers ---------------------------------------------------------

// React Native's Flow uses syntax only hermes-parser reads; use the app's copy.
const appRoot = rnIndex.path.slice(0, rnIndex.path.lastIndexOf('/node_modules/'));
const hermesParser = createRequire(path.join(appRoot, 'package.json'))('hermes-parser');

function parseFile(file) {
  const code = readFileSync(file, 'utf8');
  if (/\.tsx?$/.test(file)) {
    return babelParse(code, { sourceType: 'unambiguous', errorRecovery: true, plugins: ['typescript', 'jsx'] });
  }
  return hermesParser.parse(code, { babel: true, sourceType: 'module', allowReturnOutsideFunction: true });
}

/** Depth-first walk with parents. `visit` returning false skips the node's children. */
function walk(node, visit, parent = null) {
  if (visit(node, parent) === false) return;
  for (const key in node) {
    if (key === 'loc' || key.endsWith('Comments')) continue;
    const child = node[key];
    for (const c of Array.isArray(child) ? child : [child]) {
      if (c && typeof c.type === 'string') walk(c, visit, node);
    }
  }
}

const requireOf = (node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'Identifier' &&
  node.callee.name === 'require' &&
  node.arguments[0]?.type === 'StringLiteral'
    ? node.arguments[0].value
    : undefined;

// --- 1. Classify react-native/index.js dependencies ---------------------------

const getters = new Map(); // getter name -> Set of require specifiers in its body
const topLevel = new Set(); // specifiers required outside any getter
walk(parseFile(rnIndex.path).program, (node) => {
  if (node.type === 'ObjectMethod' && node.kind === 'get') {
    const specifiers = new Set();
    walk(node.body, (n) => {
      const s = requireOf(n);
      if (s) specifiers.add(s);
    });
    getters.set(node.key.name ?? node.key.value, specifiers);
    return false;
  }
  const s = requireOf(node);
  if (s) topLevel.add(s);
});

const getterTargets = new Map([...getters.keys()].map((g) => [g, []]));
const alwaysFollowed = [];
const unclassified = [];
for (const dep of rnIndex.dependencies) {
  if (topLevel.has(dep.name)) {
    alwaysFollowed.push(dep.path);
    continue;
  }
  const owners = [...getters].filter(([, specs]) => specs.has(dep.name)).map(([g]) => g);
  if (owners.length === 0) unclassified.push(dep.name);
  for (const g of owners) getterTargets.get(g).push(dep.path);
}
if (unclassified.length > 0) throw new Error(`Unclassified react-native/index.js dependencies: ${unclassified.join(', ')}`);

// --- 2. Reachability -------------------------------------------------------

const roots = [...graph.entryPoints, ...graph.runBeforeMainModule].filter((p) => byPath.has(p));

/**
 * Modules reachable from the roots when only the given getters' edges out of
 * react-native/index.js are followed. Maps each module to how it was reached.
 */
function reach(allowedGetters) {
  const via = new Map(roots.map((r) => [r, null]));
  const queue = [...roots];
  const visit = (from, to, label) => {
    if (!via.has(to) && byPath.has(to)) {
      via.set(to, { from, label });
      queue.push(to);
    }
  };
  while (queue.length > 0) {
    const from = queue.shift();
    if (from === rnIndex.path) {
      for (const to of alwaysFollowed) visit(from, to, 'top-level require');
      for (const g of allowedGetters) for (const to of getterTargets.get(g)) visit(from, to, `getter ${g}`);
    } else {
      for (const d of byPath.get(from).dependencies) visit(from, d.path, d.name);
    }
  }
  return via;
}

/** The import chain from a root to `target` in a reach() result. */
function chainTo(reached, target) {
  const chain = [];
  for (let at = target; reached.get(at); at = reached.get(at).from) {
    chain.unshift(`${path.relative(appRoot, reached.get(at).from)} --(${reached.get(at).label})-->`);
  }
  return [...chain, path.relative(appRoot, target)].join('\n  ');
}

const allGetters = [...getters.keys()];
const full = reach(allGetters);
if (full.size !== graph.modules.length) {
  throw new Error(`Following every getter reached ${full.size} of ${graph.modules.length} modules; the classification is incomplete`);
}
const r0 = reach([]);

const bytesOf = (paths) => [...paths].reduce((sum, p) => sum + byPath.get(p).bytes, 0);
const notIn = (set) => graph.modules.map((m) => m.path).filter((p) => !set.has(p));
const packageOf = (p) => {
  const i = p.lastIndexOf('node_modules/');
  if (i === -1) return '(app)';
  const [a, b] = p.slice(i + 13).split('/');
  return a.startsWith('@') ? `${a}/${b}` : a;
};
const byPackage = (paths) => {
  const totals = new Map();
  for (const p of paths) totals.set(packageOf(p), (totals.get(packageOf(p)) ?? 0) + byPath.get(p).bytes);
  return [...totals].sort((a, b) => b[1] - a[1]);
};

// --- 3. Which getters does the app read? (heuristic) ------------------------

/**
 * Names read from `react-native` in one file, or `all` with a reason when the
 * file uses the module object in a way we can't follow (spread, computed key,
 * passing it around, `export *`).
 */
function accessesIn(file) {
  const names = new Set();
  const allReasons = [];
  const all = (why) => allReasons.push(why);
  let ast;
  try {
    ast = parseFile(file);
  } catch (error) {
    all(`could not parse: ${error.message.split('\n')[0]}`);
    return { names, allReasons };
  }
  const tracked = new Set(); // local identifiers bound to the react-native module object

  const bindObject = (ctx, parent) => {
    if (parent?.type === 'VariableDeclarator' && parent.init === ctx) {
      if (parent.id.type === 'Identifier') return tracked.add(parent.id.name);
      if (parent.id.type === 'ObjectPattern') {
        for (const prop of parent.id.properties) {
          if (prop.type === 'RestElement' || prop.computed) all('rest or computed destructuring');
          else names.add(prop.key.name ?? prop.key.value);
        }
        return;
      }
    }
    if (parent?.type === 'MemberExpression' && parent.object === ctx) {
      if (!parent.computed) return names.add(parent.property.name);
      if (parent.property.type === 'StringLiteral') return names.add(parent.property.value);
    }
    all(`require('react-native') used as ${parent?.type ?? 'value'}`);
  };

  walk(ast.program, (node, parent) => {
    if (node.type === 'ImportDeclaration' && node.source.value === 'react-native') {
      if (node.importKind === 'type' || node.importKind === 'typeof') return;
      for (const s of node.specifiers) {
        if (s.importKind === 'type' || s.importKind === 'typeof') continue;
        if (s.type === 'ImportSpecifier') names.add(s.imported.name ?? s.imported.value);
        else tracked.add(s.local.name);
      }
    } else if (node.type === 'ExportNamedDeclaration' && node.source?.value === 'react-native' && node.exportKind !== 'type') {
      for (const s of node.specifiers) names.add(s.local.name);
    } else if (node.type === 'ExportAllDeclaration' && node.source.value === 'react-native') {
      all("export * from 'react-native'");
    } else if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && node.callee.type === 'Import')) {
      if (node.arguments?.[0]?.value === 'react-native' || node.source?.value === 'react-native') all("import('react-native')");
    } else if (requireOf(node) === 'react-native') {
      bindObject(node, parent);
    } else if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      /^_interopRequire(Default|Wildcard)$/.test(node.callee.name) &&
      node.arguments[0] &&
      requireOf(node.arguments[0]) === 'react-native'
    ) {
      // Babel's CommonJS interop wrapper: judge the wrapper's context instead.
      bindObject(node, parent);
      return false;
    }
  });

  if (tracked.size > 0) {
    walk(ast.program, (node, parent) => {
      if (node.type !== 'Identifier' || !tracked.has(node.name)) return;
      if (parent?.type === 'VariableDeclarator' && parent.id === node) return;
      if (parent?.type === 'ImportDefaultSpecifier' || parent?.type === 'ImportNamespaceSpecifier') return;
      if (parent?.type === 'MemberExpression' && parent.object === node) {
        if (!parent.computed) return names.add(parent.property.name);
        if (parent.property.type === 'StringLiteral') return names.add(parent.property.value);
      }
      if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
      if ((parent?.type === 'ObjectProperty' || parent?.type === 'ClassProperty') && parent.key === node && !parent.computed) return;
      all(`${node.name} used as ${parent?.type ?? 'value'}`);
    });
  }
  return { names, allReasons };
}

const used = new Set();
const allReadsBy = [];
const scanned = new Set();
for (;;) {
  const reachable = reach(used);
  let changed = false;
  for (const path of reachable.keys()) {
    if (scanned.has(path) || path === rnIndex.path) continue;
    scanned.add(path);
    if (!existsSync(path) || !/react-native['"]/.test(readFileSync(path, 'utf8'))) continue;
    const { names, allReasons } = accessesIn(path);
    if (allReasons.length > 0) allReadsBy.push({ path, reasons: [...new Set(allReasons)] });
    for (const n of allReasons.length > 0 ? allGetters : names) {
      if (getters.has(n) && !used.has(n)) {
        used.add(n);
        changed = true;
      }
    }
  }
  if (!changed) break;
}
const kept = reach(used);

// --- 4. Report ----------------------------------------------------------------

if (process.env.WHY) {
  const target = [...kept.keys()].find((p) => p.endsWith(process.env.WHY));
  console.log(target ? `Why ${process.env.WHY} is kept:\n  ${chainTo(kept, target)}\n` : `${process.env.WHY} is not kept.\n`);
}

const kib = (b) => `${(b / 1024).toFixed(1)} KiB`;
const pct = (a, b) => `${((a / b) * 100).toFixed(1)}%`;
const total = bytesOf(byPath.keys());
const rnTotal = bytesOf(graph.modules.map((m) => m.path).filter((p) => packageOf(p) === 'react-native'));
const ceiling = notIn(r0);
const removable = notIn(kept);
const marginal = allGetters
  .map((g) => ({ getter: g, bytes: bytesOf(notIn(r0).filter((p) => reach([g]).has(p))) }))
  .sort((a, b) => b.bytes - a.bytes);

const lines = [
  `Modules: ${graph.modules.length}, module code ${kib(total)} (react-native package: ${kib(rnTotal)}).`,
  `Getters on react-native's entry: ${getters.size}; dependencies classified: ${rnIndex.dependencies.length} (${alwaysFollowed.length} top-level).`,
  '',
  `Reachable with every getter edge cut (always kept): ${kib(bytesOf(r0.keys()))}, ${r0.size} modules.`,
  `Ceiling, reachable only through getters: ${kib(bytesOf(ceiling))} (${pct(bytesOf(ceiling), total)} of module code), ${ceiling.length} modules.`,
  ...byPackage(ceiling).map(([name, b]) => `  ${name}: ${kib(b)}`),
  '',
  `Getters read by reachable code (heuristic): ${used.size} of ${getters.size}: ${[...used].sort().join(', ')}`,
  ...(allReadsBy.length > 0
    ? ['Files that use the module object in ways we can\'t follow (all getters counted as used):', ...allReadsBy.map((f) => `  ${f.path}: ${f.reasons.join('; ')}`)]
    : ['No file uses the module object in a way we can\'t follow.']),
  `Removable if unread getters were dropped (heuristic): ${kib(bytesOf(removable))} (${pct(bytesOf(removable), total)} of module code, ${pct(
    bytesOf(removable.filter((p) => packageOf(p) === 'react-native')),
    rnTotal,
  )} of react-native), ${removable.length} modules.`,
  '',
  'Most expensive getters (bytes reachable only through that getter, overlaps counted for each):',
  ...marginal.slice(0, 15).map(({ getter, bytes }) => `  ${getter}${used.has(getter) ? ' (read)' : ''}: ${kib(bytes)}`),
];
console.log(lines.join('\n'));

if (flag === '--json' && jsonOut) {
  writeFileSync(
    jsonOut,
    JSON.stringify(
      {
        modules: graph.modules.length,
        moduleCodeBytes: total,
        reactNativeBytes: rnTotal,
        getters: getters.size,
        alwaysKeptBytes: bytesOf(r0.keys()),
        ceilingBytes: bytesOf(ceiling),
        ceilingByPackage: Object.fromEntries(byPackage(ceiling)),
        usedGetters: [...used].sort(),
        allReadsBy,
        removableBytes: bytesOf(removable),
        removableByPackage: Object.fromEntries(byPackage(removable)),
        removable: removable.map((p) => ({ path: path.relative(appRoot, p), bytes: byPath.get(p).bytes })),
        marginal,
      },
      null,
      2,
    ) + '\n',
  );
}
