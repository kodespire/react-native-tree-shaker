import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface Split {
  kept: string[];
  removed: string[];
}

interface Outcome {
  modules: Split;
  exports: Record<string, Split>;
  output?: string[];
}

interface Expected extends Outcome {
  description: string;
  phase: number;
  entry: string;
  /** Different outcomes for some builds, by variant: `metro` or `babel`, plus `+inlineRequires`. */
  overrides?: Record<string, Partial<Outcome>>;
  notes?: string;
}

const VARIANTS = ['metro', 'babel', 'metro+inlineRequires', 'babel+inlineRequires'];

const cases = readdirSync(__dirname).filter((name) => statSync(path.join(__dirname, name)).isDirectory());

/** Every .js file in a case, including its checked-in node_modules. */
function jsFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return jsFiles(path.join(dir, entry.name), relative);
    return entry.name.endsWith('.js') ? [relative] : [];
  });
}

function expectDisjoint({ kept, removed }: Split, what: string) {
  const overlap = kept.filter((item) => removed.includes(item));
  expect(overlap, `${what} listed as both kept and removed`).toEqual([]);
}

it('has fixture cases', () => {
  expect(cases.length).toBeGreaterThan(0);
});

describe.each(cases)('%s', (name) => {
  const dir = path.join(__dirname, name);
  const expected = JSON.parse(readFileSync(path.join(dir, 'expected.json'), 'utf8')) as Expected;

  it('has a well-formed expected.json', () => {
    expect(expected.description).toEqual(expect.any(String));
    expect([1, 3]).toContain(expected.phase);
    expect(Array.isArray(expected.modules.kept) && Array.isArray(expected.modules.removed)).toBe(true);
    expect(expected.exports).toEqual(expect.any(Object));
    expect(existsSync(path.join(dir, 'package.json')), 'case needs its own package.json').toBe(true);
  });

  const outcomes: Array<[string, Outcome]> = [
    ['', expected],
    ...Object.entries(expected.overrides ?? {}).map(([variant, o]): [string, Outcome] => [` (${variant})`, { ...expected, ...o }]),
  ];

  it('only overrides known variants', () => {
    for (const variant of Object.keys(expected.overrides ?? {})) expect(VARIANTS).toContain(variant);
  });

  it.each(outcomes)('accounts for every module exactly once%s', (_, outcome) => {
    const listed = [...outcome.modules.kept, ...outcome.modules.removed].sort();
    expect(listed).toEqual(jsFiles(dir).sort());
    expect(outcome.modules.kept).toContain(expected.entry);
    expectDisjoint(outcome.modules, 'module');
  });

  it.each(outcomes)('only lists exports that exist in kept modules%s', (_, outcome) => {
    for (const [file, split] of Object.entries(outcome.exports)) {
      expect(outcome.modules.kept, `${file} has export expectations but is not kept`).toContain(file);
      expectDisjoint(split, `${file} export`);
      const source = readFileSync(path.join(dir, file), 'utf8');
      for (const exportName of [...split.kept, ...split.removed]) {
        expect(source, `${file} should mention ${exportName}`).toContain(exportName);
      }
    }
  });
});
