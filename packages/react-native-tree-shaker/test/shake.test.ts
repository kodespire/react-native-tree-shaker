import { describe, expect, it } from 'vitest';
import type { Finisher } from '../src/shaking/finish';
import { shakeExports, type InputModule } from '../src/shaking/shake';

const mod = (body: string) => `__d(function(g,r,i,a,m,e,d){${body}});`;
const esm = (body: string) => mod(`Object.defineProperty(e,"__esModule",{value:!0});${body}`);

function graph(modules: Record<string, { code: string; dependencies?: string[] }>): Map<string, InputModule> {
  return new Map(
    Object.entries(modules).map(([path, { code, dependencies = [] }]) => [
      path,
      { path, code, source: '', data: { code } as InputModule['data'], dependencies: dependencies.map((d) => ({ path: d, async: false })) },
    ]),
  );
}

// Stands in for re-minifying: keeps the edited code as is.
const finish: Finisher = async (module, edited) => ({ ...module.data, code: edited.code });

describe('shakeExports', () => {
  it('removes unread exports and modules nothing requires anymore', async () => {
    const modules = graph({
      'index.js': { code: mod('f(r(d[0]).x)'), dependencies: ['lib.js'] },
      'lib.js': { code: esm('e.x=1,e.y=r(d[0]).z'), dependencies: ['dep.js'] },
      'dep.js': { code: esm('e.z=1') },
    });
    const result = await shakeExports(modules, { roots: ['index.js'], hasSideEffects: () => false, finish });
    expect(result.failure).toBeUndefined();
    expect([...result.removed]).toEqual(['dep.js']);
    expect(result.outputs.get('lib.js')?.code).not.toContain('e.y');
  });

  it("keeps modules Metro lists but no code requires, as Metro built them", async () => {
    // As when the minifier removed the only require (a /*#__PURE__*/ call inlined by inlineRequires).
    const modules = graph({
      'index.js': { code: mod('f(r(d[0]).x)'), dependencies: ['lib.js', 'dead.js'] },
      'lib.js': { code: esm('e.x=1,e.y=2') },
      'dead.js': { code: esm('e.w=r(d[0]).y'), dependencies: ['lib.js'] },
    });
    const result = await shakeExports(modules, { roots: ['index.js'], hasSideEffects: () => false, finish });
    expect(result.failure).toBeUndefined();
    expect(result.unreferenced).toEqual(['dead.js']);
    expect(result.removed.size).toBe(0);
    expect(result.outputs.has('dead.js')).toBe(false);
    // dead.js still reads y.
    expect(result.outputs.has('lib.js')).toBe(false);
  });
});
