import { describe, expect, it } from 'vitest';
import { analyzeModule, type DependencyInfo } from '../src/analysis/analyzeModule';
import { editModule, type Edits } from '../src/shaking/edit';

const mod = (body: string, params = 'g,r,i,a,m,e,d') => `__d(function(${params}){${body}});`;
const esm: DependencyInfo = { esModule: true };

function edit(code: string, dependencies: DependencyInfo[], edits: Partial<Edits> & { sideEffects?: number[] }) {
  const result = editModule(code, 'm.js', dependencies, {
    removeExports: edits.removeExports ?? new Set(),
    dropStars: edits.dropStars ?? new Set(),
    dropRequires: edits.dropRequires ?? new Set(),
    hasSideEffects: (i) => (edits.sideEffects ?? []).includes(i),
  });
  return result?.code ?? null;
}
const exportsOf = (code: string, dependencies: DependencyInfo[] = []) => {
  const shape = analyzeModule(code, dependencies).exports;
  return shape.kind === 'static' ? [...shape.names].sort() : shape.reason;
};

describe('removing exports', () => {
  it("removes Babel's exports, placeholders included, and keeps calls that may have side effects", () => {
    const named = mod(
      'var u=r(d[0]);Object.defineProperty(e,"__esModule",{value:!0}),e.counter=e.Used=e.Unused=e.Klass=void 0,e.unused=function(){return 2},e.used=function(){return 1};' +
        "var n=u(r(d[1])),t=u(r(d[2]));e.Used='U',e.Unused='X',e.counter=0,e.Klass=(0,n.default)(function u(){(0,t.default)(this,u)})",
    );
    const deps = [{ helper: 'interopRequireDefault' as const }, esm, esm];
    const out = edit(named, deps, { removeExports: new Set(['unused', 'Unused', 'counter', 'Klass']) })!;
    expect(exportsOf(out, deps)).toEqual(['Used', 'used']);
    expect(out).toContain('(0,n.default)(function u()'); // createClass call kept: it might have side effects
    expect(out).toContain('__esModule');
  });

  it('removes re-export getters', () => {
    const reexport = mod(
      'Object.defineProperty(e,"__esModule",{value:!0}),Object.defineProperty(e,"notUsed",{enumerable:!0,get:function(){return r(d[0]).b}}),' +
        'Object.defineProperty(e,"reexported",{enumerable:!0,get:function(){return r(d[0]).a}})',
    );
    const out = edit(reexport, [esm], { removeExports: new Set(['notUsed']) })!;
    expect(exportsOf(out, [esm])).toEqual(['reexported']);
    expect(analyzeModule(out, [esm]).reads.get(0)).toEqual(new Set(['a']));
  });

  it("drops eager re-exports, keeping the require only for modules with side effects (Metro's lowering)", () => {
    const reexport = mod(`"use strict";Object.defineProperty(e,'__esModule',{value:!0}),e.reexported=r(d[0]).a,e.notUsed=r(d[1]).b`);
    expect(edit(reexport, [esm, esm], { removeExports: new Set(['notUsed']) })).not.toContain('d[1]');
    expect(edit(reexport, [esm, esm], { removeExports: new Set(['notUsed']), sideEffects: [1] })).toContain('r(d[1])');
  });

  it('drops a re-export read from a variable holding the module, and the require once nothing uses it', () => {
    const reexport = mod(`"use strict";Object.defineProperty(e,'__esModule',{value:!0});var t=r(d[0]),u=i(d[1]);e.deep=t.deep,e.other=t.other,e.Unused=u`);
    const out = edit(reexport, [esm, esm], { removeExports: new Set(['other', 'Unused']) })!;
    expect(exportsOf(out, [esm, esm])).toEqual(['deep']);
    expect(out).not.toContain('t.other');
    expect(out).not.toContain('d[1]'); // side-effect free and now unused
    expect(edit(reexport, [esm, esm], { removeExports: new Set(['other', 'Unused']), sideEffects: [1] })).toContain('i(d[1])');
  });

  it("keeps an export's value where the module uses it too (Babel's `p = e.x = y`)", () => {
    const chained = mod('Object.defineProperty(e,"__esModule",{value:!0}),e.x=void 0;var y=make(),p=e.x=y;e.run=function(){return p()}');
    const out = edit(chained, [], { removeExports: new Set(['x']) })!;
    expect(exportsOf(out)).toEqual(['run']);
    expect(out).toMatch(/p=y\b/);
    const defined = mod('var o=Object.defineProperty(e,"x",{get:function(){return 1}});f(o)');
    expect(edit(defined, [], { removeExports: new Set(['x']) })).toMatch(/o=e\b/);
  });

  it('drops an IIFE that only declares and returns, as typia emits for validators', () => {
    const validator = mod('e.isX=(()=>{const t=n=>"string"==typeof n.a;return n=>"object"==typeof n&&t(n)})()');
    expect(edit(validator, [], { removeExports: new Set(['isX']) })).not.toContain('=>');
    const effectful = mod('e.x=(()=>{register();return 1})()');
    expect(edit(effectful, [], { removeExports: new Set(['x']) })).toContain('register()');
    // A default parameter or destructuring runs code too.
    expect(edit(mod('e.x=((n=register())=>1)()'), [], { removeExports: new Set(['x']) })).toContain('register()');
    expect(edit(mod('e.x=(()=>{const{a:n}=g.config;return n})()'), [], { removeExports: new Set(['x']) })).toContain('g.config');
  });

  it("drops a require behind babel-preset-expo's inlined interop helper once the export using it goes", () => {
    const code = mod(
      'Object.defineProperty(e,"__esModule",{value:!0}),Object.defineProperty(e,"default",{enumerable:!0,get:function(){return u}});' +
        'var c,t=r(d[0]),u={oklab:((c=t)&&c.__esModule?c:{default:c}).default,keep:k()}',
    );
    const out = edit(code, [esm], { removeExports: new Set(['default']) })!;
    expect(out).not.toContain('d[0]');
    expect(out).toContain('k()'); // the object's other values keep their side effects
  });

  it('keeps a value that may have side effects', () => {
    expect(edit(mod('e.x=setup()'), [], { removeExports: new Set(['x']) })).toContain('setup()');
  });
});

describe('removing export * loops', () => {
  it("removes Babel's Object.keys loop", () => {
    const barrel = mod(
      'Object.defineProperty(e,"__esModule",{value:!0});var t={own:!0};e.own=void 0,Object.keys(r(d[0])).forEach(function(n){"default"!==n&&"__esModule"!==n&&' +
        '(Object.prototype.hasOwnProperty.call(t,n)||n in e&&e[n]===r(d[0])[n]||Object.defineProperty(e,n,{enumerable:!0,get:function(){return r(d[0])[n]}}))});e.own=1',
    );
    const out = edit(barrel, [esm], { dropStars: new Set([0]) })!;
    expect(analyzeModule(out, [esm]).stars.size).toBe(0);
    expect(out).not.toContain('d[0]');
  });

  it("removes Metro's for...in copy, keeping the __esModule marker merged into it", () => {
    const barrel = mod(`"use strict";for(var n in Object.defineProperty(e,'__esModule',{value:!0}),r(d[0]))"default"!==n&&(e[n]=r(d[0])[n]);e.own='own'`);
    const out = edit(barrel, [esm], { dropStars: new Set([0]) })!;
    expect(out).toContain('__esModule');
    expect(out).not.toContain('d[0]');
    expect(edit(barrel, [esm], { dropStars: new Set([0]), sideEffects: [0] })).toContain('r(d[0])');
  });
});

describe('removing unused requires', () => {
  it('drops requires whose value is unused', () => {
    const code = mod('var t=r(d[0]),n=r(d[1]);r(d[2]);f(n.x)');
    const out = edit(code, [esm, esm, esm], { dropRequires: new Set([0, 1, 2]) })!;
    expect(out).not.toContain('d[0]');
    expect(out).not.toContain('d[2]');
    expect(out).toContain('d[1]'); // still read
  });

  it('drops a require whose value only passes through variables and interop helpers that end up unused', () => {
    // How the minifier leaves Babel's `var _a = _interopRequireDefault(require('./a'))` (lucide-react-native's barrel).
    const code = mod('function h(t){return t&&t.__esModule?t:{default:t}}var c=r(d[0]),b=h(c),u=r(d[1]),l=h(u);f(l.default)');
    const out = edit(code, [esm, esm], { dropRequires: new Set([0]) })!;
    expect(out).not.toContain('d[0]');
    expect(out).not.toContain('h(c)');
    expect(out).toContain('d[1]');
    // A member read of undefined would throw: the whole read goes, not just the require.
    expect(edit(mod('var x=r(d[0]).a.b;r(d[0]).c'), [esm], { dropRequires: new Set([0]) })).not.toMatch(/void 0\./);
  });

  it('returns null when nothing changes', () => {
    expect(edit(mod('var t=r(d[0]);f(t)'), [esm], { dropRequires: new Set([0]) })).toBeNull();
  });
});
