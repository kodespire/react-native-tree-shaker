import { GenMapping, addMapping, setSourceContent, toEncodedMap } from '@jridgewell/gen-mapping';
import { describe, expect, it } from 'vitest';
import { analyzeBundle, packageNameOf } from '../src/analyze';
import { findDevelopmentCode } from '../src/devCode';
import { diffReports } from '../src/diff';
import { formatDiff, formatReport } from '../src/format';

// Two modules on one line plus a run statement on the next:
//   __d(function(){A},0);__d(function(){BB},1);
//   __r(0);
const code = '__d(function(){A},0);__d(function(){BB},1);\n__r(0);';
const appFile = '/app/src/App.js';
const libFile = '/app/node_modules/@scope/lib/index.js';

function plainMap() {
  const map = new GenMapping({ file: 'bundle.js' });
  addMapping(map, { generated: { line: 1, column: 0 }, source: appFile, original: { line: 1, column: 0 } });
  addMapping(map, { generated: { line: 1, column: 21 }, source: libFile, original: { line: 1, column: 0 } });
  setSourceContent(map, appFile, '');
  setSourceContent(map, libFile, '');
  return toEncodedMap(map);
}

describe('analyzeBundle', () => {
  it('measures sizes and counts module definitions', () => {
    const report = analyzeBundle({ code, label: 'test', hermesBytecodeBytes: 123 });
    expect(report.bytes.raw).toBe(Buffer.byteLength(code));
    expect(report.bytes.gzip).toBeGreaterThan(0);
    expect(report.bytes.brotli).toBeGreaterThan(0);
    expect(report.bytes.hermesBytecode).toBe(123);
    expect(report.moduleCount).toBe(2);
    expect(report.packages).toBeUndefined();
  });

  it('attributes every byte to a package using the source map', () => {
    const report = analyzeBundle({ code, map: JSON.stringify(plainMap()) });
    expect(report.packages).toEqual([
      { name: '@scope/lib', bytes: 22, sources: 1 },
      { name: '(app)', bytes: 21, sources: 1 },
      { name: '(unmapped)', bytes: 8, sources: 0 },
    ]);
    const total = report.packages!.reduce((sum, p) => sum + p.bytes, 0);
    expect(total).toBe(report.bytes.raw);
  });

  it('reads index (sectioned) source maps like Metro 0.86+ emits', () => {
    const app = new GenMapping();
    addMapping(app, { generated: { line: 1, column: 0 }, source: appFile, original: { line: 1, column: 0 } });
    const lib = new GenMapping();
    addMapping(lib, { generated: { line: 1, column: 0 }, source: libFile, original: { line: 1, column: 0 } });
    const indexMap = {
      version: 3,
      sections: [
        { offset: { line: 0, column: 0 }, map: toEncodedMap(app) },
        { offset: { line: 0, column: 21 }, map: toEncodedMap(lib) },
      ],
    };

    const report = analyzeBundle({ code, map: indexMap });
    expect(report.packages?.find((p) => p.name === '@scope/lib')?.bytes).toBe(22);
    expect(report.packages?.find((p) => p.name === '(app)')?.bytes).toBe(21);
  });

  it('reports an inlined source map comment separately', () => {
    const comment = '//# sourceMappingURL=data:application/json;charset=utf-8;base64,e30=';
    const report = analyzeBundle({ code: `${code}\n${comment}`, map: plainMap() });
    expect(report.packages?.find((p) => p.name === '(inline source map)')?.bytes).toBe(comment.length);
    expect(report.packages?.find((p) => p.name === '(unmapped)')?.bytes).toBe(9);
  });

  it('attributes unmapped module lines, such as JSON, to the source between their neighbors', () => {
    // Metro lists a JSON module in `sources` but emits no mappings for it.
    const json = '__d(function(){m.exports={"x":1}},1);';
    const bundle = ['__d(function(){A},0);', json, '__d(function(){C},2);'].join('\n');
    const map = new GenMapping();
    addMapping(map, { generated: { line: 1, column: 0 }, source: '/app/a.js', original: { line: 1, column: 0 } });
    setSourceContent(map, '/app/node_modules/mime-db/db.json', '');
    addMapping(map, { generated: { line: 3, column: 0 }, source: '/app/c.js', original: { line: 1, column: 0 } });

    const report = analyzeBundle({ code: bundle, map: toEncodedMap(map) });
    expect(report.packages?.find((p) => p.name === 'mime-db')).toEqual({ name: 'mime-db', bytes: json.length, sources: 1 });
    expect(report.packages?.find((p) => p.name === '(unmapped)')?.bytes).toBe(2); // the two newlines
  });

  it('leaves unmapped lines alone when the sources between their neighbors do not match up', () => {
    const bundle = ['__d(function(){A},0);', '__d(function(){X},1);', '__d(function(){Y},2);', '__d(function(){C},3);'].join('\n');
    const map = new GenMapping();
    addMapping(map, { generated: { line: 1, column: 0 }, source: '/app/a.js', original: { line: 1, column: 0 } });
    setSourceContent(map, '/app/x.json', '');
    addMapping(map, { generated: { line: 4, column: 0 }, source: '/app/c.js', original: { line: 1, column: 0 } });

    const report = analyzeBundle({ code: bundle, map: toEncodedMap(map) });
    expect(report.packages?.find((p) => p.name === '(unmapped)')?.bytes).toBe(21 + 21 + 3);
  });

  it('handles lines with very many mappings', () => {
    const line = '__d(function(){' + 'x;'.repeat(200_000) + '},0);';
    const map = new GenMapping();
    for (let column = 0; column < line.length; column += 2) {
      addMapping(map, { generated: { line: 1, column }, source: appFile, original: { line: 1, column: 0 } });
    }
    expect(analyzeBundle({ code: line, map: toEncodedMap(map) }).packages).toEqual([{ name: '(app)', bytes: line.length, sources: 1 }]);
  });

  it('counts multi-byte characters as bytes, not UTF-16 units', () => {
    const unicode = '__d(function(){"é"},0);';
    const map = new GenMapping();
    addMapping(map, { generated: { line: 1, column: 0 }, source: appFile, original: { line: 1, column: 0 } });
    const report = analyzeBundle({ code: unicode, map: toEncodedMap(map) });
    expect(report.packages).toEqual([{ name: '(app)', bytes: Buffer.byteLength(unicode), sources: 1 }]);
  });
});

describe('packageNameOf', () => {
  it('extracts scoped and unscoped package names from the last node_modules segment', () => {
    expect(packageNameOf('/a/node_modules/react-native/Libraries/View.js')).toBe('react-native');
    expect(packageNameOf('/a/node_modules/x/node_modules/@babel/runtime/helpers/a.js')).toBe('@babel/runtime');
    expect(packageNameOf('C:\\a\\node_modules\\lodash\\map.js')).toBe('lodash');
    expect(packageNameOf('/a/src/App.tsx')).toBe('(app)');
  });
});

describe('diffReports', () => {
  it('reports per-metric and per-package changes, largest first', () => {
    const base = analyzeBundle({ code, map: plainMap(), label: 'baseline', hermesBytecodeBytes: 1000 });
    const head = { ...base, label: 'shaken', bytes: { ...base.bytes, raw: base.bytes.raw - 10, hermesBytecode: 800 } };
    head.packages = [
      { name: '@scope/lib', bytes: 12, sources: 1 },
      { name: '(app)', bytes: 21, sources: 1 },
      { name: '(unmapped)', bytes: 8, sources: 0 },
    ];

    const diff = diffReports(base, head);
    expect(diff.base).toBe('baseline');
    expect(diff.bytes.raw.delta).toBe(-10);
    expect(diff.bytes.hermesBytecode).toEqual({ base: 1000, head: 800, delta: -200, ratio: -0.2 });
    expect(diff.packages).toEqual([{ name: '@scope/lib', base: 22, head: 12, delta: -10, ratio: -10 / 22 }]);

    const markdown = formatDiff(diff);
    expect(markdown).toContain('## baseline → shaken');
    expect(markdown).toContain('| Hermes bytecode | 1000 B | 800 B | −200 B | −20.0% |');
  });

  it('formats a single report as markdown', () => {
    const markdown = formatReport(analyzeBundle({ code, map: plainMap(), label: 'ios' }), { top: 1 });
    expect(markdown).toContain('## ios');
    expect(markdown).toContain('top 1 of 3');
    expect(markdown).toContain('| @scope/lib | 22 B |');
  });
});

describe('development-only code', () => {
  it('finds React DevTools and React development builds by path', () => {
    const found = findDevelopmentCode([
      { path: '/app/node_modules/react/cjs/react.production.js', bytes: 10 },
      { path: '/app/node_modules/react/cjs/react.development.js', bytes: 300 },
      { path: 'node_modules/react-devtools-core/dist/backend.js', bytes: 200 },
      { path: '/app/node_modules/react-devtools-core/dist/standalone.js', bytes: 50 },
      { path: '/app/src/react-devtools-core/notes.js', bytes: 1 },
    ]);
    expect(found).toEqual([
      { label: 'react/cjs/react.development.js', files: 1, bytes: 300 },
      { label: 'react-devtools-core', files: 2, bytes: 250 },
    ]);
  });

  it('reports it from the source map, with a warning in the text report', () => {
    const devFile = '/app/node_modules/react/cjs/react.development.js';
    const map = new GenMapping({ file: 'bundle.js' });
    addMapping(map, { generated: { line: 1, column: 0 }, source: appFile, original: { line: 1, column: 0 } });
    addMapping(map, { generated: { line: 1, column: 21 }, source: devFile, original: { line: 1, column: 0 } });
    const report = analyzeBundle({ code, map: toEncodedMap(map) });
    expect(report.developmentCode).toEqual([{ label: 'react/cjs/react.development.js', files: 1, bytes: 22 }]);
    expect(formatReport(report)).toContain('### Development-only code');

    const clean = analyzeBundle({ code, map: plainMap() });
    expect(clean.developmentCode).toEqual([]);
    expect(formatReport(clean)).not.toContain('Development-only');
  });
});
