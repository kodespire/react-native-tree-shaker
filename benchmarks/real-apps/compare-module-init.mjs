// Runs two builds of the same app (plain and shaken) far enough to compare
// them: loads each bundle in a Node VM with native modules stubbed, requires
// every module the shaken bundle kept, in the same order, and reports modules
// that fail to initialize in one bundle but not the other.
//
// Code that needs a real device fails the same way in both bundles, so it
// cancels out. A module that fails only after shaking is a shaker bug (for
// example an export removed although something reads it at load time).
//
// Usage: node compare-module-init.mjs <plain.js> <plain.js.map> <shaken.js> <shaken.js.map>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';

const require = createRequire(path.join(import.meta.dirname, '../../packages/react-native-tree-shaker/package.json'));
const { AnyMap, decodedMappings } = require('@jridgewell/trace-mapping');

const [plainPath, plainMap, shakenPath, shakenMap] = process.argv.slice(2);
if (!shakenMap) {
  console.error('Usage: node compare-module-init.mjs <plain.js> <plain.js.map> <shaken.js> <shaken.js.map>');
  process.exit(2);
}

/**
 * Source file → module ID, from the first mapping on each module's first line.
 * One module per line, except where a template literal spans lines. Modules
 * without mappings (JSON) are left out.
 */
function moduleSources(code, mapPath) {
  const map = new AnyMap(JSON.parse(readFileSync(mapPath, 'utf8')));
  const mappings = decodedMappings(map);
  const sources = new Map();
  let start = -1;
  let text = '';
  const finish = () => {
    const id = text.match(/,(-?\d+)(?:,\[[\d,-]*\])?(?:,"[^"]*")?\);?$/)?.[1];
    const segment = (mappings[start] ?? []).find((s) => s.length > 1);
    const source = id === undefined || !segment ? null : map.sources[segment[1]];
    if (source && !sources.has(source)) sources.set(source, Number(id));
  };
  code.split('\n').forEach((line, index) => {
    if (line.startsWith('__d(') || /^__r\(|^\/\/# /.test(line)) {
      if (start >= 0) finish();
      start = line.startsWith('__d(') ? index : -1;
      text = line;
    } else if (start >= 0) {
      text += '\n' + line;
    }
  });
  if (start >= 0) finish();
  return sources;
}

/** Stands in for any native object: every property, call and construction returns it again. */
function universalStub() {
  const target = function () {};
  const proxy = new Proxy(target, {
    get(_, key) {
      if (key === Symbol.toPrimitive) return (hint) => (hint === 'number' ? 0 : '');
      if (key === Symbol.iterator) return function* () {};
      if (typeof key === 'symbol' || key === 'then') return undefined;
      if (key === 'toString' || key === 'valueOf') return () => '';
      return proxy;
    },
    apply: () => proxy,
    construct: () => proxy,
  });
  return proxy;
}

function load(code) {
  const noop = () => 0;
  const native = universalStub();
  const context = vm.createContext(
    {
      console: { log() {}, info() {}, warn() {}, error() {}, debug() {}, trace() {}, group() {}, groupEnd() {}, table() {} },
      setTimeout: noop,
      clearTimeout: noop,
      setInterval: noop,
      clearInterval: noop,
      setImmediate: noop,
      clearImmediate: noop,
      requestAnimationFrame: noop,
      cancelAnimationFrame: noop,
      queueMicrotask: noop,
      nativeModuleProxy: native,
      __turboModuleProxy: () => native,
      nativeFabricUIManager: native,
    },
    { microtaskMode: 'afterEvaluate' },
  );
  // Everything but the trailing run statements (`__r(id);`).
  const modulesOnly = code
    .split('\n')
    .filter((line) => !/^__r\(-?\d+\);?$/.test(line))
    .join('\n');
  vm.runInContext(modulesOnly, context, { timeout: 60_000 });
  return context;
}

function initialize(context, id) {
  try {
    vm.runInContext(`__r(${id})`, context, { timeout: 10_000 });
    return null;
  } catch (error) {
    return String(error?.message ?? error).split('\n')[0].slice(0, 200);
  }
}

const plainCode = readFileSync(plainPath, 'utf8');
const shakenCode = readFileSync(shakenPath, 'utf8');
const plainIds = moduleSources(plainCode, plainMap);
const shakenIds = moduleSources(shakenCode, shakenMap);
const plain = load(plainCode);
const shaken = load(shakenCode);

// Same order in both: the shaken bundle's modules, by source path.
const order = [...shakenIds.keys()].filter((s) => plainIds.has(s)).sort();
const differences = [];
let failedBoth = 0;
for (const source of order) {
  const before = initialize(plain, plainIds.get(source));
  const after = initialize(shaken, shakenIds.get(source));
  if (before !== null && after !== null) failedBoth++;
  if ((before === null) !== (after === null)) differences.push({ source, plain: before ?? 'ok', shaken: after ?? 'ok' });
}

console.log(`${order.length} modules required in both bundles. ${failedBoth} failed in both (code that needs a device).`);
console.log(`${differences.length} behave differently:`);
for (const d of differences) console.log(`  ${d.source}\n    plain:  ${d.plain}\n    shaken: ${d.shaken}`);
process.exit(differences.length === 0 ? 0 : 1);
