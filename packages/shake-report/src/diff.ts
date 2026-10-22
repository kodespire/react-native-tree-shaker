import type { BundleReport } from './analyze';

export interface Delta {
  base: number;
  head: number;
  delta: number;
  /** `delta / base`, or null when base is 0. */
  ratio: number | null;
}

export interface PackageDelta extends Delta {
  name: string;
}

export interface ReportDiff {
  base?: string;
  head?: string;
  bytes: {
    raw: Delta;
    gzip: Delta;
    brotli: Delta;
    hermesBytecode?: Delta;
  };
  moduleCount: Delta;
  /** Packages whose size changed, largest absolute change first. Present when both reports have package data. */
  packages?: PackageDelta[];
}

export function diffReports(base: BundleReport, head: BundleReport): ReportDiff {
  const diff: ReportDiff = {
    ...(base.label !== undefined && { base: base.label }),
    ...(head.label !== undefined && { head: head.label }),
    bytes: {
      raw: delta(base.bytes.raw, head.bytes.raw),
      gzip: delta(base.bytes.gzip, head.bytes.gzip),
      brotli: delta(base.bytes.brotli, head.bytes.brotli),
    },
    moduleCount: delta(base.moduleCount, head.moduleCount),
  };

  if (base.bytes.hermesBytecode !== undefined && head.bytes.hermesBytecode !== undefined) {
    diff.bytes.hermesBytecode = delta(base.bytes.hermesBytecode, head.bytes.hermesBytecode);
  }

  if (base.packages && head.packages) {
    const before = new Map(base.packages.map((p) => [p.name, p.bytes]));
    const after = new Map(head.packages.map((p) => [p.name, p.bytes]));
    diff.packages = [...new Set([...before.keys(), ...after.keys()])]
      .map((name) => ({ name, ...delta(before.get(name) ?? 0, after.get(name) ?? 0) }))
      .filter((p) => p.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name));
  }

  return diff;
}

function delta(base: number, head: number): Delta {
  return { base, head, delta: head - base, ratio: base === 0 ? null : (head - base) / base };
}
