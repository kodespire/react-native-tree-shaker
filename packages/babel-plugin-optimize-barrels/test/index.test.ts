import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import optimizeBarrels from '../src/index';

function transform(code: string) {
  return transformSync(code, {
    babelrc: false,
    configFile: false,
    plugins: [[optimizeBarrels, { packages: ['big-lib'] }]],
  })?.code;
}

describe('optimize-barrels', () => {
  it('loads in Babel and leaves code unchanged for now', () => {
    const code = "import { Button } from 'big-lib';\nconsole.log(Button);";
    expect(transform(code)).toBe(code);
  });

  it.todo('rewrites `export { X } from` re-exports to the defining module');
  it.todo('rewrites `export { default as X } from` to a default import');
  it.todo('follows `export *` chains to the defining module');
  it.todo('keeps the barrel import when a name comes from CommonJS or is ambiguous');
  it.todo('keeps namespace imports (`import * as lib`) unchanged');
  it.todo('respects package `exports` maps when building the rewritten path');
  it.todo('adds barrel file contents to the cache key');
});
