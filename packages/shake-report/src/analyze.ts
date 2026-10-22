import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { AnyMap, decodedMappings } from '@jridgewell/trace-mapping';
import { findDevelopmentCode, type DevelopmentCode } from './devCode';

export interface PackageSize {
  /** npm package name, `(app)` for files outside node_modules, `(unmapped)`, or `(inline source map)`. */
  name: string;
  bytes: number;
  /** Number of distinct source files attributed to the package. */
  sources: number;
}

export interface BundleReport {
  schemaVersion: 1;
  label?: string;
  bytes: {
    raw: number;
    gzip: number;
    brotli: number;
    hermesBytecode?: number;
  };
  /** Count of `__d(` module definitions. Approximate: string literals containing `__d(` also count. */
  moduleCount: number;
  /** Bytes per package, largest first. Present only when a source map was given. */
  packages?: PackageSize[];
  /**
   * Development-only code found in the bundle (React DevTools, React's
   * `*.development.js` builds), largest first. Present only when a source map
   * was given; empty when there is none.
   */
  developmentCode?: DevelopmentCode[];
}

export interface AnalyzeInput {
  code: string;
  /** Source map as JSON text or a parsed object. Index (sectioned) maps from Metro 0.86+ are supported. */
  map?: string | object;
  hermesBytecodeBytes?: number;
  label?: string;
}

export function analyzeBundle({ code, map, hermesBytecodeBytes, label }: AnalyzeInput): BundleReport {
  const buffer = Buffer.from(code);
  const report: BundleReport = {
    schemaVersion: 1,
    ...(label !== undefined && { label }),
    bytes: {
      raw: buffer.length,
      gzip: gzipSync(buffer, { level: 9 }).length,
      brotli: brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
      ...(hermesBytecodeBytes !== undefined && { hermesBytecode: hermesBytecodeBytes }),
    },
    moduleCount: code.match(/__d\(/g)?.length ?? 0,
  };

  if (map !== undefined) {
    const bySource = bytesBySource(code, typeof map === 'string' ? JSON.parse(map) : map);
    report.packages = bytesByPackage(bySource);
    report.developmentCode = findDevelopmentCode([...bySource].flatMap(([path, bytes]) => (typeof path === 'string' ? [{ path, bytes }] : [])));
  }
  return report;
}

const INLINE_SOURCE_MAP = /^\/\/[#@] sourceMappingURL=data:/;
const INLINE = Symbol('inline source map');

/**
 * Attributes every byte of the bundle to the source file of the mapping that
 * covers it. Metro emits no mappings for some modules, notably JSON files,
 * but still lists them in `sources` in bundle order; those module lines are
 * attributed by position (see `unmappedModuleSources`). Remaining bytes before
 * a line's first mapping, in mappings with no source, and newlines count as
 * `(unmapped)`; an inlined source map comment counts as `(inline source map)`.
 * The totals add up to the bundle size.
 */
function bytesBySource(code: string, rawMap: any): Map<string | null | typeof INLINE, number> {
  const map = new AnyMap(rawMap);
  const mappings = decodedMappings(map);
  const lines = code.split('\n');

  const bySource = new Map<string | null | typeof INLINE, number>();
  const add = (source: string | null | typeof INLINE, text: string) => {
    if (text.length > 0) bySource.set(source, (bySource.get(source) ?? 0) + Buffer.byteLength(text));
  };

  bySource.set(null, lines.length - 1);
  const byPosition = unmappedModuleSources(lines, mappings);
  lines.forEach((line, i) => {
    if (INLINE_SOURCE_MAP.test(line)) {
      add(INLINE, line);
      return;
    }
    const positional = byPosition.get(i);
    if (positional !== undefined) {
      add(map.sources[positional] ?? null, line);
      return;
    }
    let cursor = 0;
    let source: string | null = null;
    for (const segment of mappings[i] ?? []) {
      add(source, line.slice(cursor, segment[0]));
      cursor = segment[0];
      source = segment.length > 1 ? (map.sources[segment[1]!] ?? null) : null;
    }
    add(source, line.slice(cursor));
  });
  return bySource;
}

function bytesByPackage(bySource: Map<string | null | typeof INLINE, number>): PackageSize[] {
  const packages = new Map<string, { bytes: number; sources: Set<string> }>();
  for (const [source, bytes] of bySource) {
    const name = source === null ? '(unmapped)' : source === INLINE ? '(inline source map)' : packageNameOf(source);
    const entry = packages.get(name) ?? { bytes: 0, sources: new Set<string>() };
    entry.bytes += bytes;
    if (typeof source === 'string') entry.sources.add(source);
    packages.set(name, entry);
  }

  return [...packages]
    .map(([name, { bytes, sources }]) => ({ name, bytes, sources: sources.size }))
    .filter((p) => p.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
}

/**
 * Source indices for Metro module lines (`__d(...)`) that have no mappings.
 * Metro writes one module per line and lists sources in the same order, so a
 * run of unmapped module lines between two mapped lines belongs to the sources
 * between theirs that no mapping uses. Only assigned when the counts match.
 */
export function unmappedModuleSources(lines: string[], mappings: ReturnType<typeof decodedMappings>): Map<number, number> {
  // Lowest and highest source index each line maps to; minified lines can hold
  // hundreds of thousands of segments, so no spreading into Math.min/max.
  const used = new Set<number>();
  const ranges = mappings.map((segments) => {
    let low = Infinity;
    let high = -Infinity;
    for (const s of segments) {
      if (s.length < 2) continue;
      used.add(s[1]!);
      if (s[1]! < low) low = s[1]!;
      if (s[1]! > high) high = s[1]!;
    }
    return low <= high ? { low, high } : undefined;
  });

  const assigned = new Map<number, number>();
  let previousSource = -1;
  let run: number[] = [];
  const flush = (nextSource: number) => {
    const candidates: number[] = [];
    for (let s = previousSource + 1; s < nextSource; s++) if (!used.has(s)) candidates.push(s);
    if (run.length > 0 && candidates.length === run.length) run.forEach((line, k) => assigned.set(line, candidates[k]));
    run = [];
  };

  lines.forEach((line, i) => {
    const range = ranges[i];
    if (range) {
      flush(range.low);
      previousSource = range.high;
    } else if (/__d\(/.test(line.slice(0, 40))) {
      run.push(i);
    }
  });
  return assigned;
}

/** `…/node_modules/@scope/pkg/lib/x.js` → `@scope/pkg`; files outside node_modules → `(app)`. */
export function packageNameOf(source: string): string {
  const normalized = source.replace(/\\/g, '/');
  const marker = 'node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return '(app)';

  const [first, second] = normalized.slice(index + marker.length).split('/');
  return first.startsWith('@') && second ? `${first}/${second}` : first;
}
