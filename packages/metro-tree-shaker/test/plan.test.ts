import { describe, expect, it } from 'vitest';
import { planGetterShaking, type GraphModule } from '../src/reactNative/plan';

const RN = '/app/node_modules/react-native/index.js';
const lib = (name: string) => `/app/node_modules/react-native/Libraries/${name}.js`;

function graph(spec: Record<string, { deps: string[]; body: string }>): Map<string, GraphModule> {
  return new Map(
    Object.entries(spec).map(([path, { deps, body }]) => [
      path,
      {
        path,
        dependencies: new Map(deps.map((d, i) => [String(i), { absolutePath: d }])),
        output: [{ type: 'js/module', data: { code: `__d(function(g,r,i,a,m,e,d){${body}});` } }],
      },
    ]),
  );
}

// react-native's entry: View, Modal, Animated, plus a top-level helper.
const entry = {
  deps: [lib('View'), lib('Modal'), lib('Animated'), lib('helper')],
  body: 'r(d[3]);m.exports={get View(){return r(d[0]).default},get Modal(){return r(d[1]).default},get Animated(){return r(d[2]).default}}',
};

describe('planGetterShaking', () => {
  it('removes modules reachable only through getters nobody reads', () => {
    const plan = planGetterShaking(
      graph({
        '/app/index.js': { deps: [RN], body: 'r(d[0]).View' },
        [RN]: entry,
        [lib('View')]: { deps: [], body: 'e.default=1' },
        [lib('Modal')]: { deps: [lib('Shared')], body: 'r(d[0])' },
        [lib('Animated')]: { deps: [lib('Shared')], body: 'r(d[0])' },
        [lib('Shared')]: { deps: [], body: '' },
        [lib('helper')]: { deps: [], body: '' },
      }),
      ['/app/index.js'],
    )!;
    expect(plan.keptGetters).toEqual(['View']);
    expect(plan.getterCount).toBe(3);
    expect([...plan.removed].sort()).toEqual([lib('Animated'), lib('Modal'), lib('Shared')]);
    expect(plan.removedBytes).toBeGreaterThan(0);
  });

  it('keeps getters read by code that is itself behind a read getter', () => {
    const plan = planGetterShaking(
      graph({
        '/app/index.js': { deps: [RN], body: 'r(d[0]).Modal' },
        [RN]: entry,
        [lib('View')]: { deps: [], body: '' },
        [lib('Modal')]: { deps: [RN], body: 'r(d[0]).Animated' },
        [lib('Animated')]: { deps: [], body: '' },
        [lib('helper')]: { deps: [], body: '' },
      }),
      ['/app/index.js'],
    )!;
    expect(plan.keptGetters).toEqual(['Animated', 'Modal']);
    expect([...plan.removed]).toEqual([lib('View')]);
  });

  it('follows reads through a module that re-exports react-native', () => {
    const shim = '/app/node_modules/react-native-worklets/bundleMode/shims/reactNativeShim.js';
    const plan = planGetterShaking(
      graph({
        // The app is scanned before the shim is known to be an alias.
        '/app/index.js': { deps: [shim], body: 'r(d[0]).Modal' },
        [shim]: { deps: [RN], body: 'm.exports=r(d[0])' },
        [RN]: entry,
        [lib('View')]: { deps: [], body: '' },
        [lib('Modal')]: { deps: [], body: '' },
        [lib('Animated')]: { deps: [], body: '' },
        [lib('helper')]: { deps: [], body: '' },
      }),
      ['/app/index.js'],
    )!;
    expect(plan.keptGetters).toEqual(['Modal']);
    expect([...plan.removed].sort()).toEqual([lib('Animated'), lib('View')]);
  });

  it('honors getters the user asked to keep', () => {
    const plan = planGetterShaking(
      graph({
        '/app/index.js': { deps: [RN], body: 'r(d[0]).View' },
        [RN]: entry,
        [lib('View')]: { deps: [], body: '' },
        [lib('Modal')]: { deps: [], body: '' },
        [lib('Animated')]: { deps: [], body: '' },
        [lib('helper')]: { deps: [], body: '' },
      }),
      ['/app/index.js'],
      ['Modal', 'NotAGetter'],
    )!;
    expect(plan.keptGetters).toEqual(['Modal', 'View']);
    expect([...plan.removed]).toEqual([lib('Animated')]);
  });

  it('removes nothing and names the file when a read cannot be followed', () => {
    const plan = planGetterShaking(
      graph({
        '/app/index.js': { deps: [RN, '/app/util.js'], body: 'r(d[0]).View;r(d[1])' },
        '/app/util.js': { deps: [RN], body: 'var t=r(d[0]);console.log(Object.keys(t))' },
        [RN]: entry,
        [lib('View')]: { deps: [], body: '' },
        [lib('Modal')]: { deps: [], body: '' },
        [lib('Animated')]: { deps: [], body: '' },
        [lib('helper')]: { deps: [], body: '' },
      }),
      ['/app/index.js'],
    )!;
    expect(plan.removed.size).toBe(0);
    expect(plan.skipped).toEqual([{ file: '/app/util.js', reason: expect.stringContaining('CallExpression') }]);
  });

  it('lists every blocking file, including ones only reachable through getters', () => {
    const plan = planGetterShaking(
      graph({
        '/app/index.js': { deps: [RN, '/app/a.js', '/app/b.js'], body: 'r(d[0]).View;r(d[1]);r(d[2])' },
        '/app/a.js': { deps: [RN], body: 'f(r(d[0]))' },
        '/app/b.js': { deps: [RN], body: 'r(d[0]).Text' },
        [RN]: entry,
        [lib('View')]: { deps: [], body: '' },
        [lib('Modal')]: { deps: [RN], body: 'var t=r(d[0]);t[k]' },
        [lib('Animated')]: { deps: [], body: '' },
        [lib('helper')]: { deps: [], body: '' },
      }),
      ['/app/index.js'],
    )!;
    expect(plan.removed.size).toBe(0);
    expect(plan.skipped?.map((s) => s.file)).toEqual(['/app/a.js', lib('Modal')]);
  });

  it('removes nothing when some module is not reachable from the roots', () => {
    const plan = planGetterShaking(
      graph({
        '/app/index.js': { deps: [RN], body: 'r(d[0]).View' },
        '/app/orphan.js': { deps: [], body: '' },
        [RN]: entry,
        [lib('View')]: { deps: [], body: '' },
        [lib('Modal')]: { deps: [], body: '' },
        [lib('Animated')]: { deps: [], body: '' },
        [lib('helper')]: { deps: [], body: '' },
      }),
      ['/app/index.js'],
    )!;
    expect(plan.removed.size).toBe(0);
    expect(plan.skipped?.[0].reason).toContain('not reachable');
  });

  it('skips instead of throwing when code does not parse', () => {
    const modules = graph({
      '/app/index.js': { deps: [RN], body: 'r(d[0]).View' },
      [RN]: entry,
      [lib('View')]: { deps: [], body: '' },
      [lib('Modal')]: { deps: [], body: '' },
      [lib('Animated')]: { deps: [], body: '' },
      [lib('helper')]: { deps: [], body: '' },
    });
    const broken = (path: string) => ({ ...modules.get(path)!, output: [{ type: 'js/module', data: { code: '__d(function({' } }] });

    const badEntry = planGetterShaking(new Map([...modules, [RN, broken(RN)]]), ['/app/index.js'])!;
    expect(badEntry.removed.size).toBe(0);
    expect(badEntry.skipped).toEqual([{ file: RN, reason: expect.stringContaining('could not be analyzed') }]);

    const badImporter = planGetterShaking(new Map([...modules, ['/app/index.js', broken('/app/index.js')]]), ['/app/index.js'])!;
    expect(badImporter.removed.size).toBe(0);
    expect(badImporter.skipped?.map((s) => s.file)).toEqual(['/app/index.js']);
  });

  it('returns null when react-native is not in the graph', () => {
    expect(planGetterShaking(graph({ '/app/index.js': { deps: [], body: '' } }), ['/app/index.js'])).toBeNull();
  });
});
