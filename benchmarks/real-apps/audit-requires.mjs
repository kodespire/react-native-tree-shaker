// Checks a minified Metro bundle for requires of modules it doesn't define,
// which throw "Requiring unknown module" when they run. Independent of the
// shaker's own self-check: it reads only the final bundle and its source map.
//
// react-native's entry is expected to show up after getter shaking: its
// unread getters keep pointing at the modules they would have loaded.
//
// Usage: node audit-requires.mjs <bundle.js> <bundle.js.map>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(import.meta.dirname, '../../packages/react-native-tree-shaker/package.json'));
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { AnyMap, originalPositionFor } = require('@jridgewell/trace-mapping');

const [bundlePath, mapPath] = process.argv.slice(2);
if (!bundlePath || !mapPath) {
  console.error('Usage: node audit-requires.mjs <bundle.js> <bundle.js.map>');
  process.exit(2);
}
const lines = readFileSync(bundlePath, 'utf8').split('\n');
const map = new AnyMap(JSON.parse(readFileSync(mapPath, 'utf8')));

// One module per line, __d(function(g,r,i,a,m,e,d){...},id,[deps],"name"?),
// except where a template literal spans lines.
const chunks = [];
lines.forEach((line, index) => {
  if (line.startsWith('__d(')) chunks.push({ index, text: line });
  else if (line.startsWith('__r(') || line.startsWith('//# sourceMappingURL')) chunks.push(null);
  else if (chunks.at(-1)) chunks.at(-1).text += '\n' + line;
});
// Module IDs can be negative (react-native-worklets' bundle mode uses some).
const numberOf = (node) =>
  node?.type === 'NumericLiteral' ? node.value : node?.type === 'UnaryExpression' && node.operator === '-' ? -numberOf(node.argument) : undefined;
const modules = [];
chunks.filter(Boolean).forEach(({ index, text }) => {
  const ast = parse(text);
  const call = ast.program.body[0]?.expression;
  const [factory, idNode, deps] = call?.arguments ?? [];
  const id = numberOf(idNode);
  if (factory?.type !== 'FunctionExpression' || id === undefined) throw new Error(`Line ${index + 1}: not a Metro module`);
  const dependencies = deps?.type === 'ArrayExpression' ? deps.elements.map(numberOf) : [];
  const source = originalPositionFor(map, { line: index + 1, column: factory.body.start + 1 }).source ?? `(line ${index + 1})`;

  // The dependencies the code requires: d[N] for the factory's 7th parameter.
  const used = new Set();
  let dynamic = false;
  traverse(ast, {
    FunctionExpression(p) {
      if (p.node !== factory) return;
      const param = p.node.params[6];
      const binding = param?.type === 'Identifier' ? p.scope.getBinding(param.name) : undefined;
      for (const ref of binding?.referencePaths ?? []) {
        const member = ref.parent;
        if (member.type === 'MemberExpression' && member.object === ref.node && member.computed && member.property.type === 'NumericLiteral') {
          used.add(dependencies[member.property.value]);
        } else if (!(member.type === 'MemberExpression' && !member.computed && member.property.name === 'paths')) {
          dynamic = true;
        }
      }
      p.stop();
    },
  });
  modules.push({ id, source, used, dynamic });
});

const defined = new Set(modules.map((m) => m.id));
const problems = [];
for (const m of modules) {
  const missing = [...m.used].filter((target) => target !== undefined && !defined.has(target));
  if (missing.length > 0 || m.dynamic) problems.push({ source: m.source, missing: missing.length, dynamic: m.dynamic });
}

console.log(`${modules.length} modules. ${problems.length} reference modules the bundle doesn't define${problems.some((p) => p.dynamic) ? ' or use the dependency map dynamically' : ''}.`);
for (const p of problems) console.log(`  ${p.source}: ${p.missing} missing${p.dynamic ? ', dynamic dependency map' : ''}`);
const unexpected = problems.filter((p) => !/node_modules[\\/]react-native[\\/]index\.js$/.test(p.source));
process.exit(unexpected.length === 0 ? 0 : 1);
