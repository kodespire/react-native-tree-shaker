// How much of a bundle an ESM tree shaker could act on: bytes per package
// (from a shake-report JSON with source-map data) grouped by whether the
// installed package ships ESM and declares itself free of side effects.
//
// Usage: node shakeable-surface.mjs <report.json> <app-root>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const [reportPath, appRoot] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const appRequire = createRequire(path.join(path.resolve(appRoot), 'package.json'));

function classify(name) {
  if (name.startsWith('(')) return name === '(app)' ? 'app code' : 'unmapped';
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(appRequire.resolve(`${name}/package.json`), 'utf8'));
  } catch {
    return 'package.json not resolvable';
  }
  const exportsText = JSON.stringify(pkg.exports ?? {});
  const esm = Boolean(pkg.module || pkg['react-native'] || pkg.type === 'module' || /"import"|\.mjs"/.test(exportsText));
  const sideEffectFree = pkg.sideEffects === false || Array.isArray(pkg.sideEffects);
  if (esm && sideEffectFree) return 'ESM, sideEffects declared';
  if (esm) return 'ESM, no sideEffects field';
  return 'CommonJS only';
}

const groups = new Map();
for (const p of report.packages) {
  const group = classify(p.name);
  const entry = groups.get(group) ?? { bytes: 0, packages: [] };
  entry.bytes += p.bytes;
  entry.packages.push(p);
  groups.set(group, entry);
}

const total = report.bytes.raw;
const kib = (b) => `${(b / 1024).toFixed(0)} KiB`;
console.log(`${report.label}: ${kib(total)}`);
for (const [group, { bytes, packages }] of [...groups].sort((a, b) => b[1].bytes - a[1].bytes)) {
  const top = packages
    .filter((p) => !p.name.startsWith('('))
    .slice(0, 6)
    .map((p) => `${p.name} ${kib(p.bytes)}`)
    .join(', ');
  console.log(`  ${group.padEnd(30)} ${kib(bytes).padStart(10)}  ${((bytes / total) * 100).toFixed(1).padStart(5)}%  ${top}`);
}
