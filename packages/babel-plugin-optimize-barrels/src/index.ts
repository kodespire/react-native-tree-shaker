import type { ConfigAPI, PluginObj } from '@babel/core';

export interface OptimizeBarrelsOptions {
  /**
   * Packages whose barrel imports may be rewritten. Phase 2 will also detect
   * barrels automatically for packages that declare `sideEffects: false`.
   */
  packages?: string[];
}

/**
 * Phase 2 (not implemented yet): for `import { X } from 'pkg'` where `pkg`'s
 * entry only re-exports, follow the re-exports and rewrite to an import of the
 * module that defines `X`. The plugin must add the barrel files' contents to
 * Babel's cache key so edits to `node_modules` invalidate it.
 */
export default function optimizeBarrels(_api: ConfigAPI, _options: OptimizeBarrelsOptions = {}): PluginObj {
  return {
    name: 'optimize-barrels',
    visitor: {},
  };
}
