import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  analyzeBundle,
  compileHermes,
  diffReports,
  findHermesc,
  formatDiff,
  type BundleReport,
} from '@react-native-tree-shaker/shake-report';
import type { ResolvedConfig } from './config';
import { planRuns, type PlanFilter, type Run } from './plan';

export interface RunResult {
  run: Run;
  report?: BundleReport;
  /** Wall-clock time of the variant's command. */
  buildMs?: number;
  error?: string;
}

export interface RunOptions extends PlanFilter {
  dryRun?: boolean;
  log?: (line: string) => void;
}

export async function runBenchmarks(config: ResolvedConfig, options: RunOptions = {}): Promise<{ results: RunResult[]; summary: string }> {
  const log = options.log ?? ((line: string) => console.log(line));
  const runs = planRuns(config, options);
  const results: RunResult[] = [];

  for (const run of runs) {
    const label = `${run.app.name}/${run.platform}/${run.variant.name}`;
    log(`▶ ${label}\n  $ ${run.command}`);
    if (options.dryRun) {
      results.push({ run });
      continue;
    }
    try {
      results.push({ run, ...(await executeRun(run, config, label)) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`  ✗ ${message}`);
      results.push({ run, error: message });
    }
  }

  const summary = summarize(results);
  if (!options.dryRun) {
    await mkdir(config.outDir, { recursive: true });
    await writeFile(path.join(config.outDir, 'summary.md'), summary);
  }
  return { results, summary };
}

async function executeRun(run: Run, config: ResolvedConfig, label: string): Promise<{ report: BundleReport; buildMs: number }> {
  await mkdir(path.dirname(run.files.bundle), { recursive: true });
  // Stale outputs from an earlier run would otherwise be measured as this run's.
  await Promise.all(Object.values(run.files).map((file) => rm(file, { force: true })));

  const start = performance.now();
  await exec(run.command, run.appRoot, run.variant.env);
  const buildMs = Math.round(performance.now() - start);
  if (!existsSync(run.files.bundle)) throw new Error(`command finished but wrote no bundle at ${run.files.bundle}`);

  const hermesc = run.app.hermesc ? path.resolve(config.baseDir, run.app.hermesc) : findHermesc(run.appRoot);
  let hermesBytecodeBytes: number | undefined;
  if (hermesc) {
    await compileHermes({ hermesc, input: run.files.bundle, output: run.files.hbc });
    hermesBytecodeBytes = (await stat(run.files.hbc)).size;
  }

  const report = analyzeBundle({
    code: await readFile(run.files.bundle, 'utf8'),
    map: existsSync(run.files.map) ? await readFile(run.files.map, 'utf8') : undefined,
    hermesBytecodeBytes,
    label,
  });
  await writeFile(run.files.report, JSON.stringify({ ...report, buildMs }, null, 2) + '\n');
  return { report, buildMs };
}

function exec(command: string, cwd: string, env: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, env: { ...process.env, ...env }, shell: true, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`command exited with ${signal ?? `code ${code}`}`));
    });
  });
}

/**
 * One section per app and platform: a table of every variant's sizes, then a
 * diff of each later variant against the first one that succeeded for that app.
 */
function summarize(results: RunResult[]): string {
  const sections: string[] = ['# Benchmark results', ''];

  const groups = new Map<string, RunResult[]>();
  for (const result of results) {
    const key = `${result.run.app.name} (${result.run.platform})`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }

  for (const [key, group] of groups) {
    sections.push(`## ${key}`, '');
    const measured = group.filter((r): r is RunResult & { report: BundleReport } => r.report !== undefined);

    if (measured.length > 0) {
      sections.push(
        '| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...measured.map(({ run, report, buildMs }) => {
          const cells = [
            run.variant.name,
            kib(report.bytes.raw),
            kib(report.bytes.gzip),
            kib(report.bytes.brotli),
            report.bytes.hermesBytecode === undefined ? '—' : kib(report.bytes.hermesBytecode),
            String(report.moduleCount),
            buildMs === undefined ? '—' : `${(buildMs / 1000).toFixed(1)} s`,
          ];
          return `| ${cells.join(' | ')} |`;
        }),
        '',
      );
    }

    for (const result of group) {
      if (result.error) sections.push(`- **${result.run.variant.name}** failed: ${result.error}`, '');
      else if (!result.report) sections.push(`- **${result.run.variant.name}**: not run`, '');
    }

    const [baseline, ...rest] = measured;
    for (const result of rest) {
      sections.push(formatDiff(diffReports(baseline.report, result.report), { top: 10 }).replace(/^## /m, '### '));
    }
  }
  return sections.join('\n');
}

function kib(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
