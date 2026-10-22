import type { InputConfigT } from 'metro-config';
import type { SideEffectsField } from '@metro-tree-shaker/side-effects-db';
import { checkMetroVersion } from './metroVersion';
import { createTreeShakingSerializer } from './serializer';

export interface TreeShakingOptions {
  /**
   * Keep the wrapper installed but never shake. Useful for size A/B runs.
   * Defaults to true.
   */
  enabled?: boolean;
  /**
   * react-native getters to keep even when no read of them is found, for code
   * the analysis can't see. Names as exported by react-native, e.g. `'Animated'`.
   */
  keepReactNativeGetters?: string[];
  /**
   * Remove exports nothing reads, and the code and modules only they needed
   * (general tree shaking). Defaults to true.
   */
  shakeExports?: boolean;
  /**
   * `sideEffects` per package name, overriding package.json and the curated
   * database: `false` lets unused modules of that package be removed.
   */
  sideEffects?: Record<string, SideEffectsField>;
  /** Don't print the summary lines for each production bundle. */
  quiet?: boolean;
}

// metro-config's defaults, for configs that don't set the minifier.
const DEFAULT_MINIFIER = {
  minifierPath: 'metro-minify-terser',
  minifierConfig: {
    mangle: { toplevel: false },
    output: { ascii_only: true, quote_style: 3, wrap_iife: true },
    sourceMap: { includeSources: false },
    toplevel: false,
    compress: { reduce_funcs: false },
  },
};

/**
 * Adds tree shaking to a Metro config. Production bundles only; development
 * builds pass through unchanged.
 *
 * Any `serializer.customSerializer` already in the config is wrapped, not
 * replaced, so apply this before or after other config wrappers that also
 * install a serializer.
 */
export function withTreeShaking<T extends InputConfigT>(config: T, options: TreeShakingOptions = {}): T {
  const projectRoot = config.projectRoot ?? process.cwd();

  const warning = checkMetroVersion(projectRoot);
  if (warning) {
    console.warn(`[metro-tree-shaker] ${warning}`);
  }

  // Both kinds of shaking work on Metro's normal transform output, so the
  // transformer and its cache are left alone.
  const transformer = (config.transformer ?? {}) as { minifierPath?: string; minifierConfig?: Record<string, any> };
  return {
    ...config,
    serializer: {
      ...config.serializer,
      customSerializer: createTreeShakingSerializer({
        original: config.serializer?.customSerializer ?? null,
        projectRoot,
        enabled: options.enabled ?? true,
        keepReactNativeGetters: options.keepReactNativeGetters,
        shakeExports: options.shakeExports ?? true,
        sideEffects: options.sideEffects,
        minifier: {
          minifierPath: transformer.minifierPath ?? DEFAULT_MINIFIER.minifierPath,
          minifierConfig: transformer.minifierConfig ?? DEFAULT_MINIFIER.minifierConfig,
        },
        log: options.quiet ? () => {} : undefined,
      }),
    },
  };
}
