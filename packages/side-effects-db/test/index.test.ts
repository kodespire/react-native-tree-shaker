import { describe, expect, it } from 'vitest';
import { database, hasSideEffects, lookup, resolveSideEffects, type SideEffectsDatabase } from '../src/index';

const db: SideEffectsDatabase = {
  packages: {
    'example-lib': [
      { sideEffects: false, versions: '>=2', evidence: 'https://example.com/v2' },
      { sideEffects: ['./register.js'], versions: '<2', evidence: 'https://example.com/v1' },
    ],
  },
};

describe('hasSideEffects', () => {
  it('honors boolean values', () => {
    expect(hasSideEffects(true, 'index.js')).toBe(true);
    expect(hasSideEffects(false, 'index.js')).toBe(false);
  });

  it('matches globs relative to the package root', () => {
    const field = ['./src/polyfill.js', 'lib/register/*.js'];
    expect(hasSideEffects(field, 'src/polyfill.js')).toBe(true);
    expect(hasSideEffects(field, './lib/register/native.js')).toBe(true);
    expect(hasSideEffects(field, 'src/index.js')).toBe(false);
  });

  it('matches globs without a slash at any depth, like webpack', () => {
    expect(hasSideEffects(['*.css'], 'src/deep/button.css')).toBe(true);
    expect(hasSideEffects(['setup.js'], 'lib/setup.js')).toBe(true);
    expect(hasSideEffects(['setup.js'], 'lib/other.js')).toBe(false);
  });

  it('normalizes Windows separators', () => {
    expect(hasSideEffects(['src/polyfill.js'], 'src\\polyfill.js')).toBe(true);
  });
});

describe('resolveSideEffects', () => {
  it('prefers user overrides, then the database, then package.json', () => {
    const base = { packageName: 'example-lib', packageVersion: '2.1.0', declared: true, db };
    expect(resolveSideEffects({ ...base, overrides: { 'example-lib': ['x.js'] } })).toEqual({ value: ['x.js'], source: 'override' });
    expect(resolveSideEffects(base)).toEqual({ value: false, source: 'database' });
    expect(resolveSideEffects({ ...base, packageName: 'other-lib' })).toEqual({ value: true, source: 'package.json' });
  });

  it('picks the database entry for the installed version', () => {
    expect(lookup(db, 'example-lib', '1.4.0')?.sideEffects).toEqual(['./register.js']);
    expect(lookup(db, 'example-lib', '3.0.0-beta.1')?.sideEffects).toBe(false);
    expect(lookup(db, 'missing', '1.0.0')).toBeUndefined();
  });

  it('assumes side effects when nothing is known', () => {
    expect(resolveSideEffects({ packageName: 'unknown', packageVersion: '1.0.0', declared: undefined, db })).toEqual({
      value: true,
      source: 'default',
    });
  });
});

describe('bundled database', () => {
  it('only contains entries with a version range and evidence link', () => {
    for (const [name, entries] of Object.entries(database.packages)) {
      expect(entries.length, name).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.versions, name).toBeTruthy();
        expect(() => new URL(entry.evidence), name).not.toThrow();
      }
    }
  });
});
