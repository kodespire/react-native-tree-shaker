// Runs metro-tree-shaker's e2e tests against each supported Metro version.
// Each version is installed once into .metro-compat/<version>.
//
// Usage: node scripts/test-metro-versions.mjs [version...]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// The latest patch of every minor in SUPPORTED_METRO_RANGE.
const DEFAULT_VERSIONS = ['0.82.5', '0.83.8', '0.84.6', '0.85.0', '0.86.0', '0.87.1'];
const E2E_TESTS = [
  'packages/metro-tree-shaker/test/metro.e2e.test.ts',
  'packages/metro-tree-shaker/test/reactNative.e2e.test.ts',
  'packages/metro-tree-shaker/test/shaking.e2e.test.ts',
];

const root = path.resolve(import.meta.dirname, '..');
const versions = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_VERSIONS;
const failed = [];

for (const version of versions) {
  const dir = path.join(root, '.metro-compat', version);
  if (!existsSync(path.join(dir, 'node_modules', 'metro', 'package.json'))) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: `metro-compat-${version}`, private: true }) + '\n');
    const packages = ['metro', 'metro-config', 'metro-runtime'].map((p) => `${p}@${version}`);
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...packages], { cwd: dir, stdio: 'inherit' });
  }

  // The test files run in parallel, so fixtures are copied once, up front.
  rmSync(path.join(dir, 'fixtures'), { recursive: true, force: true });
  cpSync(path.join(root, 'fixtures'), path.join(dir, 'fixtures'), { recursive: true });

  console.log(`\n=== Metro ${version}`);
  try {
    execFileSync('npx', ['vitest', 'run', ...E2E_TESTS], { cwd: root, stdio: 'inherit', env: { ...process.env, METRO_COMPAT_DIR: dir } });
  } catch {
    failed.push(version);
  }
}

console.log(failed.length === 0 ? `\nAll Metro versions passed: ${versions.join(', ')}` : `\nFailed: ${failed.join(', ')}`);
process.exit(failed.length === 0 ? 0 : 1);
