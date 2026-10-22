import { describe, expect, it } from 'vitest';
import { analyzeEntry, analyzeReads, UnsupportedCodeError } from '../src/reactNative/analyze';

// Metro's minified module wrapper: (global, require, importDefault, importAll, module, exports, dependencyMap).
const mod = (body: string, params = 'g,r,i,a,m,e,d') => `__d(function(${params}){${body}});`;

describe('analyzeEntry', () => {
  it('maps each getter to the dependencies only its body requires', () => {
    const code = mod(
      "'use strict';var w=r(d[4]);m.exports={get A(){return r(d[0]).default},get B(){return r(d[2]).default('x'),r(d[1]).default}," +
        "get 'C'(){return 1},get D(){return w(),r(d[3])}};r(d[3])",
    );
    const shape = analyzeEntry(code, 6);
    expect(Object.fromEntries([...shape.getters].map(([k, v]) => [k, [...v].sort()]))).toEqual({
      A: [0],
      B: [1, 2],
      C: [],
      D: [], // d[3] is also required at the top level
    });
    // 3 and 4 are required outside getters; 5 is never referenced.
    expect([...shape.alwaysFollowed].sort()).toEqual([3, 4, 5]);
  });

  it('rejects code it cannot follow', () => {
    expect(() => analyzeEntry(mod('m.exports={get [k](){return r(d[0])}}'), 1)).toThrow(UnsupportedCodeError);
    expect(() => analyzeEntry(mod('m.exports={get A(){return r(d[k])}}'), 1)).toThrow(UnsupportedCodeError);
    expect(() => analyzeEntry('var notAModule = 1;', 0)).toThrow(UnsupportedCodeError);
  });
});

describe('analyzeReads', () => {
  const reads = (body: string, entry: number[] = [0], params?: string) => {
    const result = analyzeReads(mod(body, params), new Set(entry));
    return result.kind === 'all' ? `all: ${result.reason}` : [...result.names].sort();
  };

  it('follows a variable holding the module object', () => {
    expect(reads('var t=r(d[0]);t.View;(0,t.StyleSheet.create)({});t["Text"]')).toEqual(['StyleSheet', 'Text', 'View']);
  });

  it('follows inline requires and importDefault', () => {
    expect(reads('r(d[0]).Text;i(d[0]).Image')).toEqual(['Image', 'Text']);
  });

  it('respects scopes, which minifiers reuse names across', () => {
    expect(reads('var t=r(d[0]);function f(t){return t.NotRead}t.View')).toEqual(['View']);
  });

  it('follows destructuring and aliases', () => {
    expect(reads('var {A:x,B}=r(d[0]);var t;t=r(d[0]);var u=t;u.C')).toEqual(['A', 'B', 'C']);
  });

  it('ignores requires of other modules and a bare require for side effects', () => {
    expect(reads('r(d[1]).NotRN;r(d[0]);r(c?d[1]:d[2]).Asset')).toEqual([]);
  });

  it('works with renamed wrapper parameters', () => {
    expect(reads('var M=_r(d[0]);M.View', [0], 'g,_r,_i2,_a,m,_e,d')).toEqual(['View']);
  });

  it('follows conditional dependency indices', () => {
    expect(reads('r(c?d[0]:d[1]).View')).toEqual(['View']);
  });

  it("follows Babel's lazy-import helper through its call sites", () => {
    const helper = 'function n(){var t=r(d[0]);return n=function(){return t},t}';
    expect(reads(`${helper}function f(){return(0,n().useColorScheme)()}n().View`)).toEqual(['View', 'useColorScheme']);
    expect(reads('var g=()=>r(d[0]);g().Text')).toEqual(['Text']);
    expect(reads(`${helper}var x=n;x().View`)).toMatch(/^all: .*passes n\(\), which returns the module, to a VariableDeclarator/);
    expect(reads('(function(){return r(d[0])})().View')).toMatch(/^all: .*never named/);
  });

  it('notices modules that re-export react-native', () => {
    // react-native-worklets' bundle-mode shim: `module.exports = require('react-native')`.
    const shim = analyzeReads(mod("'use strict';globalThis.x=1,m.exports=r(d[0])"), new Set([0]));
    expect(shim).toEqual({ kind: 'names', names: new Set(), reexports: true });
    const plain = analyzeReads(mod('r(d[0]).View'), new Set([0]));
    expect(plain).toEqual({ kind: 'names', names: new Set(['View']), reexports: false });
    // Assigning react-native to anything else on `module` still escapes.
    expect(reads('m.other=r(d[0])')).toMatch(/^all: /);
  });

  describe("Babel's interop helpers", () => {
    // d[0] is react-native; d[1] is @babel/runtime's interopRequireWildcard, d[2] its interopRequireDefault.
    const helpers = new Map([
      [1, 'interopRequireWildcard'],
      [2, 'interopRequireDefault'],
    ] as const);
    const readsWithHelpers = (body: string) => {
      const result = analyzeReads(mod(body), new Set([0]), helpers);
      return result.kind === 'all' ? `all: ${result.reason}` : [...result.names].sort();
    };

    it('follows `import RN, { UIManager }` through interopRequireWildcard', () => {
      // As compiled in react-native-webrtc: getters are copied by descriptor; `.default` is the object.
      expect(readsWithHelpers('var t=r(d[1]).default;var f=t(r(d[0]));f.UIManager.x;f.default.findNodeHandle()')).toEqual([
        'UIManager',
        'findNodeHandle',
      ]);
      expect(readsWithHelpers('var f=r(d[1])(r(d[0]));var {default:RN,View}=f;RN.Text')).toEqual(['Text', 'View']);
    });

    it('follows `import RN from` through interopRequireDefault, where only `.default` leads anywhere', () => {
      expect(readsWithHelpers('var n=r(d[2]);var t=n(r(d[0]));t.default.Image;t.notAnExport')).toEqual(['Image']);
    });

    it('recognizes helpers Babel inlined', () => {
      const wildcard =
        '(function(e,i){if(!i&&e&&e.__esModule)return e;var r,s,o=Object.defineProperty,l={__proto__:null,default:e};' +
        'for(s in e)"default"!==s&&{}.hasOwnProperty.call(e,s)&&((r=o&&Object.getOwnPropertyDescriptor(e,s))&&(r.get||r.set)?o(l,s,r):l[s]=e[s]);return l})';
      expect(reads(`var L=${wildcard}(r(d[0]));L.View`)).toEqual(['View']);
      expect(reads('function n(e){return e&&e.__esModule?e:{default:e}}var t=n(r(d[0]));t.default.Text')).toEqual(['Text']);
    });

    it('still reads everything when the wrapper escapes or the function is not a helper', () => {
      expect(readsWithHelpers('var f=r(d[1])(r(d[0]));g(f)')).toMatch(/^all: /);
      expect(readsWithHelpers('var f=r(d[1])(r(d[0]));g(f.default)')).toMatch(/^all: /);
      expect(readsWithHelpers('var h=r(d[3]);h(r(d[0])).View')).toMatch(/^all: .*CallExpression/);
      expect(reads('function n(e){return Object.keys(e)}n(r(d[0]))')).toMatch(/^all: .*CallExpression/);
    });
  });

  it.each([
    ['importAll, which copies every property', 'a(d[0]).View', 'importAll'],
    ['a computed key', 'var t=r(d[0]);t[k]', 'computed key'],
    ['a spread', 'var t=r(d[0]);var o={...t}', 'SpreadElement'],
    ['passing the object to a function', 'var t=r(d[0]);f(t)', 'CallExpression'],
    ['a rest element', 'var {A,...rest}=r(d[0])', 'rest element'],
    ['reassigning the variable', 'var t=r(d[0]);t=null;t.View', 'reassigns'],
    ['writing to an export', 'r(d[0]).View=1', 'assigns'],
    ['a computed dependency index', 'r(d[k]).View', 'dynamically'],
    ['the dependency map passed around', 'f(d)', 'dynamically'],
    ["react-native's ID outside a require", 'r(d[1])(d[0],d.paths)', 'outside a require'],
    ['a global assignment', 'X=r(d[0])', 'global'],
  ])('reads everything for %s', (_, body, reason) => {
    expect(reads(body)).toMatch(new RegExp(`^all: .*${reason}`));
  });

  it('allows d.paths for async imports of other modules', () => {
    expect(reads('r(d[1])(d[2],d.paths);r(d[0]).View')).toEqual(['View']);
  });
});
