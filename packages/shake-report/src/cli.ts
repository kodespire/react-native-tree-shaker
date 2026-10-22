#!/usr/bin/env node
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { analyzeBundle, type BundleReport } from './analyze';
import { diffReports } from './diff';
import { formatDiff, formatReport } from './format';
import { compileHermes } from './hermes';

const USAGE = `Usage:
  shake-report stats <bundle.js> [--map <file>] [--hbc <file> | --hermesc <path>] [--label <name>] [--json <out>] [--top <n>]
  shake-report diff <base.json> <head.json> [--top <n>]`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      map: { type: 'string' },
      hbc: { type: 'string' },
      hermesc: { type: 'string' },
      label: { type: 'string' },
      json: { type: 'string' },
      top: { type: 'string', default: '20' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, ...files] = positionals;
  const top = Number.parseInt(values.top!, 10);

  if (values.help || !command) {
    console.log(USAGE);
    return values.help ? 0 : 1;
  }

  if (command === 'stats' && files.length === 1) {
    const [bundlePath] = files;
    const report = analyzeBundle({
      code: await readFile(bundlePath, 'utf8'),
      map: values.map ? await readFile(values.map, 'utf8') : undefined,
      hermesBytecodeBytes: await hermesBytecodeSize(bundlePath, values),
      label: values.label ?? path.basename(bundlePath),
    });
    if (values.json) await writeFile(values.json, JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(formatReport(report, { top }));
    return 0;
  }

  if (command === 'diff' && files.length === 2) {
    const [base, head] = await Promise.all(files.map(async (f) => JSON.parse(await readFile(f, 'utf8')) as BundleReport));
    process.stdout.write(formatDiff(diffReports(base, head), { top }));
    return 0;
  }

  console.error(USAGE);
  return 1;
}

async function hermesBytecodeSize(bundlePath: string, values: { hbc?: string; hermesc?: string }): Promise<number | undefined> {
  if (values.hbc) return (await stat(values.hbc)).size;
  if (!values.hermesc) return undefined;

  const dir = await mkdtemp(path.join(os.tmpdir(), 'shake-report-'));
  try {
    const output = path.join(dir, 'bundle.hbc');
    await compileHermes({ hermesc: values.hermesc, input: bundlePath, output });
    return (await stat(output)).size;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
