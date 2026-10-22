#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadConfig, type Platform } from './config';
import { runBenchmarks } from './run';

const USAGE = `Usage: npm run bench -- [--config benchmarks/bench.config.json] [--app <name>]... [--variant <name>]... [--platform ios|android]... [--dry-run]`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      config: { type: 'string', default: 'benchmarks/bench.config.json' },
      app: { type: 'string', multiple: true },
      variant: { type: 'string', multiple: true },
      platform: { type: 'string', multiple: true },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }

  const config = await loadConfig(values.config!);
  const { results, summary } = await runBenchmarks(config, {
    apps: values.app,
    variants: values.variant,
    platforms: values.platform as Platform[] | undefined,
    dryRun: values['dry-run'],
  });

  if (!values['dry-run']) console.log(`\n${summary}`);
  return results.some((r) => r.error) ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
