import { describe, expect, it } from 'vitest';
import { analyzeModule, type DependencyInfo, type ModuleAnalysis } from '../src/analysis/analyzeModule';

const mod = (body: string, params = 'g,r,i,a,m,e,d') => `__d(function(${params}){${body}});`;
const esm: DependencyInfo = { esModule: true };
const cjs: DependencyInfo = { esModule: false };

/** Reads per dependency index as sorted arrays, or `all`. */
function reads(analysis: ModuleAnalysis) {
  return Object.fromEntries([...analysis.reads].map(([i, r]) => [i, r instanceof Set ? [...r].sort() : 'all']));
}
const exportNames = (analysis: ModuleAnalysis) =>
  analysis.exports.kind === 'static' ? [...analysis.exports.names].sort() : `pinned: ${analysis.exports.reason}`;

// Real Metro 0.87 output, minified, for the same modules in both dialects.
describe("Babel's CommonJS dialect (@react-native/babel-preset)", () => {
  it('reads named exports, defaults through interopRequireDefault, and namespaces through interopRequireWildcard', () => {
    const index =
      'var e,t=_r(d[0])(_r(d[1])),r=(function(t,r){if(!r&&t&&t.__esModule)return t;var n,o,a=Object.defineProperty,f={__proto__:null,default:t};' +
      'if(Object(t)!==t)return f;if(e||"function"!=typeof WeakMap||(e=new WeakMap),e){if(e.has(t))return e.get(t);e.set(t,f)}' +
      'for(o in t)"default"!==o&&{}.hasOwnProperty.call(t,o)&&((n=a&&Object.getOwnPropertyDescriptor(t,o))&&(n.get||n.set)?a(f,o,n):f[o]=t[o]);return f})(_r(d[2]));' +
      'console.log((0,_r(d[3]).used)(),_r(d[3]).Used,t.default,r.a,_r(d[4]).fromStar,_r(d[5]).reexported)';
    const analysis = analyzeModule(mod(index, 'g,_r,i,_a,m,_e,d'), [{ helper: 'interopRequireDefault' }, esm, esm, esm, esm, esm]);
    expect(reads(analysis)).toEqual({ 0: 'all', 1: ['default'], 2: ['a'], 3: ['Used', 'used'], 4: ['fromStar'], 5: ['reexported'] });
    expect(analysis.exports).toEqual({ kind: 'static', names: new Set() });
  });

  it('finds exports, including void 0 placeholders, and the __esModule marker', () => {
    const named =
      'var u=r(d[0]);Object.defineProperty(e,"__esModule",{value:!0}),e.counter=e.Used=e.Unused=e.Klass=void 0,e.unused=function(){return 2},e.used=function(){return 1};' +
      "var n=u(r(d[1])),t=u(r(d[2]));e.Used='U',e.Unused='X',e.counter=0,e.Klass=(0,n.default)(function u(){(0,t.default)(this,u)})";
    const analysis = analyzeModule(mod(named), [{ helper: 'interopRequireDefault' }, esm, esm]);
    expect(exportNames(analysis)).toEqual(['Klass', 'Unused', 'Used', 'counter', 'unused', 'used']);
    expect(analysis.esModule).toBe(true);
    expect(reads(analysis)).toEqual({ 0: 'all', 1: ['default'], 2: ['default'] });
  });

  it('follows re-exports through their getters', () => {
    const reexport =
      'var t=r(d[0]);Object.defineProperty(e,"__esModule",{value:!0}),Object.defineProperty(e,"Def",{enumerable:!0,get:function(){return n.default}}),' +
      'Object.defineProperty(e,"notUsed",{enumerable:!0,get:function(){return r(d[1]).b}}),Object.defineProperty(e,"reexported",{enumerable:!0,get:function(){return r(d[1]).a}});var n=t(r(d[2]))';
    const analysis = analyzeModule(mod(reexport), [{ helper: 'interopRequireDefault' }, esm, esm]);
    expect(exportNames(analysis)).toEqual(['Def', 'notUsed', 'reexported']);
    expect(reads(analysis)).toEqual({ 0: 'all', 1: ['a', 'b'], 2: ['default'] });
  });

  it('recognizes export * loops', () => {
    const barrel =
      'Object.defineProperty(e,"__esModule",{value:!0});var t={own:!0};e.own=void 0,Object.keys(r(d[0])).forEach(function(n){"default"!==n&&"__esModule"!==n&&' +
      '(Object.prototype.hasOwnProperty.call(t,n)||n in e&&e[n]===r(d[0])[n]||Object.defineProperty(e,n,{enumerable:!0,get:function(){return r(d[0])[n]}}))}),' +
      'Object.keys(r(d[1])).forEach(function(n){"default"!==n&&"__esModule"!==n&&(Object.prototype.hasOwnProperty.call(t,n)||n in e&&e[n]===r(d[1])[n]||' +
      "Object.defineProperty(e,n,{enumerable:!0,get:function(){return r(d[1])[n]}}))});e.own='own'";
    const analysis = analyzeModule(mod(barrel), [esm, esm]);
    expect([...analysis.stars].sort()).toEqual([0, 1]);
    expect(exportNames(analysis)).toEqual(['own']);
    expect(reads(analysis)).toEqual({ 0: [], 1: [] });
  });

  it('recognizes the loop over a module wrapped by interopRequireWildcard', () => {
    // From react-native's NativeDeviceInfo.js: `export * from` plus `export { default } from` the same module.
    const barrel =
      'var t=r(d[0]);Object.defineProperty(e,"__esModule",{value:!0});var u={};e.default=void 0;var n=t(r(d[1]));' +
      'Object.keys(n).forEach(function(t){"default"!==t&&"__esModule"!==t&&(Object.prototype.hasOwnProperty.call(u,t)||t in e&&e[t]===n[t]||' +
      'Object.defineProperty(e,t,{enumerable:!0,get:function(){return n[t]}}))});e.default=n.default';
    const analysis = analyzeModule(mod(barrel), [{ helper: 'interopRequireWildcard' }, esm]);
    expect([...analysis.stars]).toEqual([1]);
    expect(reads(analysis)).toEqual({ 0: 'all', 1: ['default'] });
    expect(exportNames(analysis)).toEqual(['default']);
  });

  it('also recognizes the loop when the module is held in a variable', () => {
    const barrel = 'var t=r(d[0]);Object.keys(t).forEach(function(n){"default"!==n&&Object.defineProperty(e,n,{enumerable:!0,get:function(){return t[n]}})});f(t.extra)';
    const analysis = analyzeModule(mod(barrel), [esm]);
    expect([...analysis.stars]).toEqual([0]);
    expect(reads(analysis)).toEqual({ 0: ['extra'] });
  });
});

describe("Metro's import/export lowering", () => {
  it('reads importDefault and importAll of ES modules by name', () => {
    const index = 'console.log(r(d[0]).used(),r(d[0]).Used,i(d[1]),a(d[2]).a,r(d[3]).fromStar,r(d[4]).reexported)';
    const analysis = analyzeModule(mod(`"use strict";${index}`), [esm, esm, esm, esm, esm]);
    expect(reads(analysis)).toEqual({ 0: ['Used', 'used'], 1: ['default'], 2: ['a'], 3: ['fromStar'], 4: ['reexported'] });
  });

  it('recognizes for...in export * copies, including one merged into the __esModule marker', () => {
    const barrel =
      `"use strict";for(var n in Object.defineProperty(e,'__esModule',{value:!0}),r(d[0]))"default"!==n&&(e[n]=r(d[0])[n]);` +
      `for(var o in r(d[1]))"default"!==o&&(e[o]=r(d[1])[o]);e.own='own'`;
    const analysis = analyzeModule(mod(barrel), [esm, esm]);
    expect([...analysis.stars].sort()).toEqual([0, 1]);
    expect(exportNames(analysis)).toEqual(['own']);
    expect(analysis.esModule).toBe(true);
  });

  it('reads eager re-exports', () => {
    const reexport = `"use strict";Object.defineProperty(e,'__esModule',{value:!0}),e.reexported=r(d[0]).a,e.notUsed=r(d[0]).b,e.Def=i(d[1])`;
    const analysis = analyzeModule(mod(reexport), [esm, esm]);
    expect(reads(analysis)).toEqual({ 0: ['a', 'b'], 1: ['default'] });
    expect(exportNames(analysis)).toEqual(['Def', 'notUsed', 'reexported']);
  });
});

describe('interop depends on whether the target is an ES module', () => {
  const read = (body: string, target: DependencyInfo) => reads(analyzeModule(mod(body), [target, { helper: 'interopRequireWildcard' }, { helper: 'interopRequireDefault' }]))[0];

  it('importDefault reads `default` of an ES module, but returns a CommonJS module itself', () => {
    expect(read('i(d[0]).X', esm)).toEqual(['default']);
    expect(read('i(d[0]).X', cjs)).toEqual(['X']);
    expect(read('i(d[0]).X', {})).toEqual(['X', 'default']);
  });

  it('importAll returns an ES module as is, but copies (reads) all of a CommonJS module', () => {
    expect(read('f(a(d[0]).X)', esm)).toEqual(['X']);
    expect(read('f(a(d[0]).X)', cjs)).toBe('all');
  });

  it('the helpers return an ES module unchanged, so `default` is an ordinary export', () => {
    expect(read('var w=r(d[1])(r(d[0]));f(w.default.Y,w.X)', esm)).toEqual(['X', 'default']);
    expect(read('var w=r(d[1])(r(d[0]));f(w.default.Y,w.X)', cjs)).toEqual(['X', 'Y']);
    expect(read('var w=r(d[2])(r(d[0]));f(w.default.Y,w.X)', cjs)).toEqual(['Y']);
    expect(read('var w=r(d[2])(r(d[0]));f(w.default.Y,w.X)', {})).toEqual(['X', 'Y', 'default']);
  });

  it("an ES module's export read and thrown away isn't a read, but a CommonJS getter might run code", () => {
    expect(read('var x=r(d[0]).X;r(d[0]).Y', esm)).toEqual([]);
    expect(read('var x=r(d[0]).X;r(d[0]).Y', cjs)).toEqual(['X', 'Y']);
    expect(read('i(d[0]);var u=i(d[0])', esm)).toEqual([]);
    expect(read('f(i(d[0]))', esm)).toEqual(['default']);
  });
});

describe('exports that cannot be removed', () => {
  it.each([
    ['reading its own export', 'e.a=1;console.log(e.a)', 'reads its own export a'],
    ['passing the exports object', 'e.a=1;f(e)', 'passes its exports object'],
    ['replacing module.exports', 'm.exports={a:1}', 'replaces module.exports'],
    ['a computed export name', 'e[k]=1', 'computed key'],
  ])('pins exports when %s', (_, body, reason) => {
    expect(exportNames(analyzeModule(mod(body), []))).toMatch(new RegExp(`^pinned: .*${reason}`));
  });

  it('treats module.exports = require(x) as an alias of x', () => {
    const analysis = analyzeModule(mod('m.exports=r(d[0])'), [cjs]);
    expect([...analysis.aliases]).toEqual([0]);
    expect(reads(analysis)).toEqual({ 0: [] });
  });

  it("is an alias of every module it may pick at runtime, like React's entry", () => {
    // NODE_ENV not inlined: both branches stay.
    const branches = analyzeModule(mod('"production"===process.env.NODE_ENV?m.exports=r(d[0]):m.exports=r(d[1])'), [cjs, cjs]);
    expect([...branches.aliases].sort()).toEqual([0, 1]);
    expect(reads(branches)).toEqual({ 0: [], 1: [] });
    const conditional = analyzeModule(mod('m.exports=p?r(d[0]):r(d[1])'), [cjs, cjs]);
    expect([...conditional.aliases].sort()).toEqual([0, 1]);
    expect(reads(conditional)).toEqual({ 0: [], 1: [] });
  });

  it("follows an assignment's own value as well as the variable", () => {
    const read = (body: string) => reads(analyzeModule(mod(body), [cjs]))[0];
    expect(read('var x;f(x=r(d[0]));g(x.a)')).toBe('all');
    expect(read('var x;g((x=r(d[0])).b,x.a)')).toEqual(['a', 'b']);
  });

  it('reads nothing from a module whose truthiness is all that is tested', () => {
    expect(reads(analyzeModule(mod('var x=r(d[0]);x?f(x.a):g();if(x)h();!x'), [esm]))[0]).toEqual(['a']);
  });

  it('reads all of a module that reaches module.exports in a way that is not an alias', () => {
    const analysis = analyzeModule(mod('m.exports=r(d[0])||{}'), [cjs]);
    expect(analysis.aliases.size).toBe(0);
    expect(reads(analysis)).toEqual({ 0: 'all' });
  });

  it('reads everything when an export * loop uses its key in another way', () => {
    const analysis = analyzeModule(mod('Object.keys(r(d[0])).forEach(function(n){g(n)})'), [esm]);
    expect(reads(analysis)).toEqual({ 0: 'all' });
    expect(analysis.stars.size).toBe(0);
  });
});

describe("babel-preset-expo's output, as the minifier leaves it", () => {
  it('follows interopRequireDefault inlined into an expression, with or without a temporary', () => {
    const withTemp = 'var c,t=r(d[0]),u={oklab:((c=t)&&c.__esModule?c:{default:c}).default};f(u)';
    expect(reads(analyzeModule(mod(withTemp), [esm]))).toEqual({ 0: ['default'] });
    // A CommonJS module comes back whole as `default`.
    expect(reads(analyzeModule(mod(withTemp), [cjs]))).toEqual({ 0: 'all' });
    expect(reads(analyzeModule(mod('var t=r(d[0]);f((t&&t.__esModule?t:{default:t}).default)'), [esm]))).toEqual({ 0: ['default'] });
  });

  it('reads all when the temporary is also used outside the helper', () => {
    const escapes = 'var c,t=r(d[0]);f(((c=t)&&c.__esModule?c:{default:c}).default);g(c)';
    expect(reads(analyzeModule(mod(escapes), [esm]))).toEqual({ 0: 'all' });
  });

  it("recognizes its inlined interopRequireWildcard", () => {
    const wildcard =
      'var n=r(d[0]),u=(function(e){if(e&&e.__esModule)return e;var t={};return e&&Object.keys(e).forEach(function(n){if("default"!==n){' +
      'var u=Object.getOwnPropertyDescriptor(e,n);Object.defineProperty(t,n,u.get?u:{enumerable:!0,get:function(){return e[n]}})}}),t.default=e,t})(n);f(u.View)';
    expect(reads(analyzeModule(mod(wildcard), [esm]))).toEqual({ 0: ['View'] });
  });

  it('keeps exports static when its export * loop checks own exports with hasOwnProperty', () => {
    const barrel =
      'Object.defineProperty(e,"__esModule",{value:!0}),Object.defineProperty(e,"own",{enumerable:!0,get:function(){return 1}});var s=r(d[0]);' +
      'Object.keys(s).forEach(function(n){"default"===n||Object.prototype.hasOwnProperty.call(e,n)||Object.defineProperty(e,n,{enumerable:!0,get:function(){return s[n]}})})';
    const analysis = analyzeModule(mod(barrel), [esm]);
    expect(exportNames(analysis)).toEqual(['own']);
    expect([...analysis.stars]).toEqual([0]);
  });
});
