import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, type BenchConfig } from '../src/config';
import { planRuns, renderCommand } from '../src/plan';
import { runBenchmarks } from '../src/run';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup(config: BenchConfig) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'bench-test-'));
  dirs.push(dir);
  const configPath = path.join(dir, 'bench.config.json');
  await writeFile(configPath, JSON.stringify(config));
  return { dir, config: await loadConfig(configPath) };
}

// Writes a fake Metro bundle with the given number of modules to {bundle}.
const fakeBundle = (modules: number) =>
  `node -e "require('fs').writeFileSync(process.argv[1], '__d(function(){},0);'.repeat(${modules}))" {bundle}`;

describe('renderCommand', () => {
  it('shell-quotes values with spaces and quotes', () => {
    expect(renderCommand('cat {bundle}', { bundle: "/tmp/it's here.js" })).toBe(`cat '/tmp/it'\\''s here.js'`);
    expect(renderCommand('cat {bundle}', { bundle: '/tmp/plain.js' })).toBe('cat /tmp/plain.js');
  });

  it('rejects unknown placeholders', () => {
    expect(() => renderCommand('x {nope}', {})).toThrow('Unknown placeholder {nope}');
  });
});

describe('planRuns', () => {
  it('expands apps × platforms × variants and respects variant app filters', async () => {
    const { dir, config } = await setup({
      apps: [
        { name: 'a', root: 'app-a', platforms: ['ios', 'android'] },
        { name: 'b', root: 'app-b', platforms: ['ios'] },
      ],
      variants: [
        { name: 'baseline', command: 'bundle {platform} {entry}' },
        { name: 'only-b', command: 'bundle {platform}', apps: ['b'] },
      ],
    });

    const runs = planRuns(config);
    expect(runs.map((r) => `${r.app.name}/${r.platform}/${r.variant.name}`)).toEqual([
      'a/ios/baseline',
      'a/android/baseline',
      'b/ios/baseline',
      'b/ios/only-b',
    ]);
    expect(runs[0].command).toBe(`bundle ios ${path.join(dir, 'app-a', 'index.js')}`);
    expect(runs[0].files.report).toBe(path.join(dir, 'results', 'a', 'ios', 'baseline.json'));

    expect(planRuns(config, { platforms: ['android'] })).toHaveLength(1);
  });

  it('validates the config', async () => {
    await expect(
      setup({ apps: [{ name: 'a', root: '.' }], variants: [{ name: 'v', command: 'x', apps: ['missing'] }] }),
    ).rejects.toThrow('unknown app "missing"');
  });
});

describe('runBenchmarks', () => {
  it('runs each variant, writes reports, and compares against the baseline', async () => {
    const { dir, config } = await setup({
      apps: [{ name: 'app', root: '.', platforms: ['android'] }],
      variants: [
        { name: 'baseline', command: fakeBundle(10) },
        { name: 'shaken', command: fakeBundle(6) },
        { name: 'broken', command: 'node -e "process.exit(3)"' },
      ],
    });

    const log: string[] = [];
    const { results, summary } = await runBenchmarks(config, { log: (line) => log.push(line) });

    expect(results.map((r) => r.report?.moduleCount ?? r.error)).toEqual([10, 6, 'command exited with code 3']);
    expect(results[0].buildMs).toEqual(expect.any(Number));
    const saved = JSON.parse(await readFile(path.join(dir, 'results/app/android/shaken.json'), 'utf8'));
    expect(saved.moduleCount).toBe(6);
    expect(saved.buildMs).toEqual(expect.any(Number));

    expect(summary).toContain('## app (android)');
    expect(summary).toMatch(/\| baseline \| 0\.2 KiB \| .+ \| — \| 10 \| \d+\.\d s \|/);
    expect(summary).toContain('### app/android/baseline → app/android/shaken');
    expect(summary).toContain('| Modules | 10 | 6 | −4 | −40.0% |');
    expect(summary).toContain('**broken** failed: command exited with code 3');
    expect(await readFile(path.join(dir, 'results/summary.md'), 'utf8')).toBe(summary);
  });

  it('compares each app against the first variant that ran for it', async () => {
    const { config } = await setup({
      apps: [
        { name: 'cli-app', root: '.', platforms: ['ios'] },
        { name: 'expo-app', root: '.', platforms: ['ios'] },
      ],
      variants: [
        { name: 'cli', command: fakeBundle(8), apps: ['cli-app'] },
        { name: 'expo', command: fakeBundle(10), apps: ['expo-app'] },
        { name: 'expo-shaken', command: fakeBundle(7), apps: ['expo-app'] },
      ],
    });

    const { summary } = await runBenchmarks(config, { log: () => {} });
    expect(summary).toContain('### expo-app/ios/expo → expo-app/ios/expo-shaken');
    expect(summary).toContain('| Modules | 10 | 7 | −3 | −30.0% |');
    expect(summary).not.toContain('cli-app/ios/cli →');
  });

  it('only prints commands in dry-run mode', async () => {
    const { config } = await setup({
      apps: [{ name: 'app', root: '.', platforms: ['ios'] }],
      variants: [{ name: 'baseline', command: 'exit 1' }],
    });
    const log: string[] = [];
    const { results } = await runBenchmarks(config, { dryRun: true, log: (line) => log.push(line) });
    expect(results[0].error).toBeUndefined();
    expect(log.join('\n')).toContain('$ exit 1');
  });
});
