import { createRequire } from 'node:module';
import path from 'node:path';
import type { EditResult } from './edit';

// Required rather than imported: TypeScript 7 can't parse this package's type declarations.
const remappingModule = require('@jridgewell/remapping');
const remapping: (map: object, loader: (file: string) => object | null) => { sources: string[] } & object =
  remappingModule.default ?? remappingModule;

/** A Metro module's JS output data: `{ code, map, lineCount, functionMap }`. */
export interface JsOutputData {
  code: string;
  /** Tuples before Metro 0.86, a VLQ map from 0.86. */
  map: unknown;
  lineCount: number;
  [key: string]: unknown;
}

export interface MinifierSettings {
  /** `transformer.minifierPath` from the app's Metro config. */
  minifierPath: string;
  /** `transformer.minifierConfig` from the app's Metro config. */
  minifierConfig: Record<string, any>;
  /** Whether the bundle is minified. Unminified bundles (as Xcode builds them for Hermes) only get dead code removed. */
  minify: boolean;
}

/** The source name an edited module's map uses for its input, so it can be traced on to the original file. */
export const editedSourceName = (modulePath: string) => `${modulePath}?metro-tree-shaker`;

/**
 * Turns an edited module into Metro module output, the way Metro's transform
 * worker does: minify with the app's minifier (removing the code edits left
 * dead), compose the source map back to the original file, terminate it, and
 * store it in the format this Metro version uses. Loads everything from the
 * app's own copy of Metro.
 */
export function createFinisher(projectRoot: string, settings: MinifierSettings) {
  const appRequire = createRequire(path.join(projectRoot, 'package.json'));
  const sourceMap = appRequire('metro-source-map');
  const minifierModule = appRequire(settings.minifierPath);
  const minifier: (options: object) => Promise<{ code: string; map?: object }> = minifierModule.default ?? minifierModule;
  const config = withTwoPasses(
    settings.minifierPath,
    settings.minify
      ? settings.minifierConfig
      : { ...settings.minifierConfig, mangle: false, output: { ...settings.minifierConfig.output, beautify: true, comments: true } },
  );

  return async function finish(module: { path: string; source: string; data: JsOutputData }, edited: EditResult): Promise<JsOutputData> {
    const original = sourceMap
      .fromRawMappings([{ code: module.data.code, map: module.data.map, source: module.source, path: module.path, functionMap: null, isIgnored: false }])
      .toMap(undefined, {});
    const inputName = editedSourceName(module.path);
    const composed = remapping(edited.map, (file) => (file === inputName ? original : null));

    const minified = await minifier({ code: edited.code, map: composed, filename: module.path, reserved: [], config });
    const tuples = minified.map ? sourceMap.toBabelSegments(minified.map).map(sourceMap.toSegmentTuple) : [];
    const { lineCount, map } = countLinesAndTerminateMap(minified.code, tuples);
    return {
      ...module.data,
      code: minified.code,
      map: Array.isArray(module.data.map) || typeof sourceMap.vlqMapFromTuples !== 'function' ? map : sourceMap.vlqMapFromTuples(map),
      lineCount,
    };
  };
}

export type Finisher = ReturnType<typeof createFinisher>;

/**
 * At least two compress passes, for terser and uglify. Removing an export
 * often leaves code only the second pass removes: the first inlines an IIFE
 * into variable assignments, the second drops the variables nothing reads.
 */
function withTwoPasses(minifierPath: string, config: Record<string, any>): Record<string, any> {
  if (!/terser|uglify/.test(minifierPath) || config.compress === false) return config;
  const compress = typeof config.compress === 'object' && config.compress !== null ? config.compress : {};
  return { ...config, compress: { ...compress, passes: Math.max(2, compress.passes ?? 1) } };
}

/** As in metro-transform-worker: count lines and end the map with a mapping at the end of the code. */
function countLinesAndTerminateMap(code: string, map: Array<number[]>): { lineCount: number; map: Array<number[]> } {
  let lineCount = 1;
  let lastLineStart = 0;
  for (const match of code.matchAll(/\r\n?|\n|\u2028|\u2029/g)) {
    lineCount++;
    lastLineStart = match.index! + match[0].length;
  }
  const terminating = [lineCount, code.length - lastLineStart];
  const last = map[map.length - 1];
  return { lineCount, map: last && last[0] === terminating[0] && last[1] === terminating[1] ? [...map] : [...map, terminating] };
}
