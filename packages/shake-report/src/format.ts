import type { BundleReport } from './analyze';
import type { Delta, ReportDiff } from './diff';

export function formatReport(report: BundleReport, { top = 20 } = {}): string {
  const rows: Array<[string, string]> = [
    ['Raw', formatBytes(report.bytes.raw)],
    ['Gzip', formatBytes(report.bytes.gzip)],
    ['Brotli', formatBytes(report.bytes.brotli)],
  ];
  if (report.bytes.hermesBytecode !== undefined) rows.push(['Hermes bytecode', formatBytes(report.bytes.hermesBytecode)]);
  rows.push(['Modules', String(report.moduleCount)]);

  const out = [`## ${report.label ?? 'Bundle'}`, '', table(['Metric', 'Value'], rows)];

  if (report.developmentCode && report.developmentCode.length > 0) {
    out.push(
      '',
      '### Development-only code',
      '',
      'This production bundle contains code only development builds need. Usually `process.env.NODE_ENV` was not inlined.',
      '',
      table(
        ['Code', 'Bytes', 'Files'],
        report.developmentCode.map((d) => [d.label, formatBytes(d.bytes), String(d.files)]),
      ),
    );
  }

  if (report.packages) {
    out.push(
      '',
      `### Largest packages (top ${Math.min(top, report.packages.length)} of ${report.packages.length})`,
      '',
      table(
        ['Package', 'Bytes', 'Share', 'Files'],
        report.packages.slice(0, top).map((p) => [p.name, formatBytes(p.bytes), percent(p.bytes / report.bytes.raw), String(p.sources)]),
      ),
    );
  }
  return out.join('\n') + '\n';
}

export function formatDiff(diff: ReportDiff, { top = 20 } = {}): string {
  const rows: Array<[string, ...string[]]> = [
    ['Raw', ...deltaCells(diff.bytes.raw, formatBytes)],
    ['Gzip', ...deltaCells(diff.bytes.gzip, formatBytes)],
    ['Brotli', ...deltaCells(diff.bytes.brotli, formatBytes)],
  ];
  if (diff.bytes.hermesBytecode) rows.push(['Hermes bytecode', ...deltaCells(diff.bytes.hermesBytecode, formatBytes)]);
  rows.push(['Modules', ...deltaCells(diff.moduleCount, String)]);

  const out = [
    `## ${diff.base ?? 'base'} → ${diff.head ?? 'head'}`,
    '',
    table(['Metric', 'Base', 'Head', 'Change', '%'], rows),
  ];

  if (diff.packages && diff.packages.length > 0) {
    out.push(
      '',
      `### Biggest package changes (top ${Math.min(top, diff.packages.length)} of ${diff.packages.length})`,
      '',
      table(
        ['Package', 'Base', 'Head', 'Change', '%'],
        diff.packages.slice(0, top).map((p) => [p.name, ...deltaCells(p, formatBytes)]),
      ),
    );
  }
  return out.join('\n') + '\n';
}

function deltaCells(d: Delta, fmt: (n: number) => string): string[] {
  const sign = d.delta > 0 ? '+' : d.delta < 0 ? '−' : '';
  return [fmt(d.base), fmt(d.head), `${sign}${fmt(Math.abs(d.delta))}`, d.ratio === null ? '—' : `${sign}${percent(Math.abs(d.ratio))}`];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function percent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function table(header: string[], rows: string[][]): string {
  const numeric = header.map((_, i) => i > 0);
  return [
    `| ${header.join(' | ')} |`,
    `| ${numeric.map((n) => (n ? '---:' : '---')).join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}
