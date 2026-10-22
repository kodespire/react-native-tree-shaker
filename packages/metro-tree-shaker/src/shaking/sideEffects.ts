import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { hasSideEffects, resolveSideEffects, type SideEffectsField } from '@metro-tree-shaker/side-effects-db';

interface PackageInfo {
  root: string;
  name: string;
  version: string;
  sideEffects: SideEffectsField | undefined;
}

/**
 * Returns a check for whether a module file may have side effects, from its
 * package's `sideEffects` field, the curated database, and user overrides.
 * Files outside any named package are assumed to have side effects.
 */
export function createSideEffectsCheck(overrides?: Record<string, SideEffectsField>): (file: string) => boolean {
  const byDirectory = new Map<string, PackageInfo | null>();

  /** The nearest package.json with a name; nested ones like `{"type": "module"}` don't count. */
  function packageOf(directory: string): PackageInfo | null {
    const cached = byDirectory.get(directory);
    if (cached !== undefined) return cached;
    let info: PackageInfo | null = null;
    const manifest = path.join(directory, 'package.json');
    if (existsSync(manifest)) {
      try {
        const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
        if (typeof pkg.name === 'string') info = { root: directory, name: pkg.name, version: pkg.version ?? '0.0.0', sideEffects: pkg.sideEffects };
      } catch {
        // Unreadable manifest: keep looking up.
      }
    }
    const parent = path.dirname(directory);
    if (!info && parent !== directory) info = packageOf(parent);
    byDirectory.set(directory, info);
    return info;
  }

  return (file) => {
    const pkg = packageOf(path.dirname(file));
    if (!pkg) return true;
    const { value } = resolveSideEffects({ packageName: pkg.name, packageVersion: pkg.version, declared: pkg.sideEffects, overrides });
    return hasSideEffects(value, path.relative(pkg.root, file));
  };
}
