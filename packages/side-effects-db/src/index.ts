import picomatch from 'picomatch';
import semver from 'semver';

/** The package.json `sideEffects` field: a boolean, or globs of files that have side effects. */
export type SideEffectsField = boolean | string[];

export interface SideEffectsEntry {
  sideEffects: SideEffectsField;
  /** Semver range of package versions the entry applies to. */
  versions: string;
  /** Link to the package source or a maintainer statement backing the entry. */
  evidence: string;
}

export interface SideEffectsDatabase {
  packages: Record<string, SideEffectsEntry[]>;
}

export type SideEffectsSource = 'override' | 'database' | 'package.json' | 'default';

export interface ResolveSideEffectsInput {
  packageName: string;
  packageVersion: string;
  /** The package's own package.json `sideEffects` field. */
  declared: SideEffectsField | undefined;
  /** User overrides, keyed by package name. These win over everything else. */
  overrides?: Record<string, SideEffectsField>;
  db?: SideEffectsDatabase;
}

// Outside `src` so contributors edit plain JSON; resolves the same from `src` and `dist`.
export const database: SideEffectsDatabase = require('../data/side-effects.json');

/** Returns the first database entry whose version range includes `version`. */
export function lookup(db: SideEffectsDatabase, packageName: string, version: string): SideEffectsEntry | undefined {
  return db.packages[packageName]?.find((entry) => semver.satisfies(version, entry.versions, { includePrerelease: true }));
}

/**
 * Decides a package's `sideEffects` value. Precedence: user override, then the
 * curated database, then the package's own package.json. Packages with no
 * information are assumed to have side effects.
 */
export function resolveSideEffects({
  packageName,
  packageVersion,
  declared,
  overrides,
  db = database,
}: ResolveSideEffectsInput): { value: SideEffectsField; source: SideEffectsSource } {
  const override = overrides?.[packageName];
  if (override !== undefined) return { value: override, source: 'override' };

  const entry = lookup(db, packageName, packageVersion);
  if (entry) return { value: entry.sideEffects, source: 'database' };

  if (declared !== undefined) return { value: declared, source: 'package.json' };

  return { value: true, source: 'default' };
}

/**
 * Whether a file has side effects, using webpack's rules for the field: globs
 * match the path relative to the package root, and a glob without a `/` matches
 * at any depth.
 */
export function hasSideEffects(field: SideEffectsField, relativePath: string): boolean {
  if (typeof field === 'boolean') return field;

  const file = normalize(relativePath);
  return field.some((pattern) => {
    const glob = normalize(pattern);
    return picomatch(glob.includes('/') ? glob : `**/${glob}`, { dot: true })(file);
  });
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}
