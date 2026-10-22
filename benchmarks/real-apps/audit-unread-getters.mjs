// Safety audit for a shaken bundle: for every getter metro-tree-shaker treated
// as unread, find that name read as a property inside modules that import
// react-native's entry (or a module that re-exports it), and show which object
// it is read from. Any line marked "READ FROM react-native" is a missed read.
//
// Usage: node audit-unread-getters.mjs <getters.json> <shaken-bundle.js>
// <getters.json> comes from getters-read.metro.config.cjs.
import { readFileSync } from 'node:fs';

const [gettersFile, bundleFile] = process.argv.slice(2);
const { unread } = JSON.parse(readFileSync(gettersFile, 'utf8'));

// Metro writes one module per line: `__d(function(...){...},<id>,[<dependency ids>]);`
const modules = readFileSync(bundleFile, 'utf8')
  .split('\n')
  .flatMap((code) => {
    const m = code.match(/\},(\d+),(\[[\d,]*\])(?:,"[^"]*")?\);$/);
    return m ? [{ id: Number(m[1]), deps: JSON.parse(m[2]), code }] : [];
  });
const entry = modules.find((m) => m.code.includes('get ActivityIndicator(){'));
if (!entry) throw new Error('react-native/index.js not found in the bundle');

const aliases = new Set([entry.id]);
for (const m of modules) {
  if (m.deps.includes(entry.id) && m.code.length < 600 && /\.exports=\w+\(\w+\[\d+\]\)\}/.test(m.code)) aliases.add(m.id);
}
const importers = modules.filter((m) => m.id !== entry.id && m.deps.some((d) => aliases.has(d)));
console.log(`${modules.length} modules; ${importers.length} import react-native${aliases.size > 1 ? ` (${aliases.size - 1} through re-exporting modules)` : ''}.`);

const escape = (s) => s.replace(/[$.()[\]]/g, '\\$&');
let missed = 0;
for (const name of unread) {
  const read = new RegExp(`([\\w$.()\\[\\]]{1,40})[.](${escape(name)})\\b|["'](${escape(name)})["']`, 'g');
  for (const m of importers) {
    const rnIndices = m.deps.flatMap((d, i) => (aliases.has(d) ? [i] : []));
    for (const hit of m.code.matchAll(read)) {
      const object = hit[1] ?? '';
      const direct = rnIndices.some((i) => object.endsWith(`(d[${i}])`));
      const bound = rnIndices.some((i) => new RegExp(`[,;{ ]${escape(object)}=\\w+\\(d\\[${i}\\]\\)`).test(m.code));
      if (direct || bound) missed++;
      const context = m.code.slice(Math.max(0, hit.index - 50), hit.index + hit[0].length + 10);
      console.log(`  ${name.padEnd(24)} ${direct || bound ? 'READ FROM react-native' : 'other object'}  …${context}…`);
    }
  }
}
console.log(missed === 0 ? 'No unread getter is read from react-native.' : `${missed} possible missed reads.`);
process.exit(missed === 0 ? 0 : 1);
