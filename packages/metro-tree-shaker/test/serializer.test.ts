import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTreeShakingSerializer, type CustomSerializer } from '../src/serializer';
import { withTreeShaking } from '../src/withTreeShaking';
import { compareVersions } from '../src/metroVersion';

const repoRoot = path.resolve(__dirname, '../../..');

type Args = Parameters<CustomSerializer>;

function fakeGraph(code: string, file = 'index.js') {
  const modulePath = path.join(repoRoot, file);
  const module = {
    path: modulePath,
    dependencies: new Map(),
    inverseDependencies: new Set(),
    getSource: () => Buffer.from(''),
    output: [{ type: 'js/module', data: { code, lineCount: 1, map: [], functionMap: null } }],
  };
  return {
    entryPoint: modulePath,
    graph: { dependencies: new Map([[modulePath, module]]), entryPoints: new Set([modulePath]) },
  };
}

function serializerOptions(dev: boolean) {
  const ids = new Map<string, number>();
  return {
    asyncRequireModulePath: '',
    createModuleId: (p: string) => {
      if (!ids.has(p)) ids.set(p, ids.size);
      return ids.get(p)!;
    },
    dev,
    getRunModuleStatement: (id: number | string) => `__r(${JSON.stringify(id)});`,
    globalPrefix: '',
    includeAsyncPaths: false,
    inlineSourceMap: false,
    modulesOnly: false,
    processModuleFilter: () => true,
    projectRoot: repoRoot,
    runBeforeMainModule: [],
    runModule: false,
    serverRoot: repoRoot,
    shouldAddToIgnoreList: () => false,
    sourceMapUrl: null,
    sourceUrl: null,
  };
}

function args(dev: boolean, file?: string): Args {
  const { entryPoint, graph } = fakeGraph('__d(function () { /* marker */ });', file);
  return [entryPoint, [], graph, serializerOptions(dev)] as unknown as Args;
}

describe('createTreeShakingSerializer', () => {
  it('falls back to Metro default serialization when nothing else is configured', async () => {
    const serialize = createTreeShakingSerializer({ original: null, projectRoot: repoRoot, enabled: true });
    const out = await serialize(...args(false));
    expect(typeof out).toBe('string');
    expect(out).toContain('/* marker */');
    expect(out).toMatch(/__d\(function \(\) \{ \/\* marker \*\/ \},\s*0\)/);
  });

  it('passes through an original serializer that returns a string', async () => {
    const original = vi.fn<CustomSerializer>(async () => 'custom-code');
    const serialize = createTreeShakingSerializer({ original, projectRoot: repoRoot, enabled: true });
    await expect(serialize(...args(false))).resolves.toBe('custom-code');
    expect(original).toHaveBeenCalledOnce();
  });

  it('preserves the source map from an original serializer that returns { code, map }', async () => {
    const result = { code: 'custom-code', map: '{"version":3,"mappings":""}' };
    const original = vi.fn<CustomSerializer>(async () => result);
    const serialize = createTreeShakingSerializer({ original, projectRoot: repoRoot, enabled: true });
    await expect(serialize(...args(false))).resolves.toEqual(result);
  });

  it('warns about development-only code in a production bundle', async () => {
    const log = vi.fn();
    const original = vi.fn<CustomSerializer>(async () => 'code');
    const serialize = createTreeShakingSerializer({ original, projectRoot: repoRoot, enabled: true, log });
    await serialize(...args(false, 'node_modules/react/cjs/react.development.js'));
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[metro-tree-shaker\] Warning: .*react\/cjs\/react\.development\.js/));

    log.mockClear();
    await serialize(...args(true, 'node_modules/react/cjs/react.development.js'));
    expect(log).not.toHaveBeenCalled();
  });

  it('is a strict pass-through in development and when disabled', async () => {
    const original = vi.fn<CustomSerializer>(async () => 'dev-code');
    const devSerialize = createTreeShakingSerializer({ original, projectRoot: repoRoot, enabled: true });
    await expect(devSerialize(...args(true))).resolves.toBe('dev-code');

    const offSerialize = createTreeShakingSerializer({ original, projectRoot: repoRoot, enabled: false });
    await expect(offSerialize(...args(false))).resolves.toBe('dev-code');
    expect(original).toHaveBeenCalledTimes(2);
  });
});

describe('withTreeShaking', () => {
  it('wraps an existing customSerializer and keeps the rest of the config', async () => {
    const original = vi.fn<CustomSerializer>(async () => 'from-original');
    const config = withTreeShaking({
      projectRoot: repoRoot,
      resolver: { sourceExts: ['js'] },
      serializer: { customSerializer: original, polyfillModuleNames: ['x'] },
    });

    expect(config.resolver).toEqual({ sourceExts: ['js'] });
    expect(config.serializer?.polyfillModuleNames).toEqual(['x']);
    expect(config.serializer?.customSerializer).not.toBe(original);
    await expect(config.serializer!.customSerializer!(...args(false))).resolves.toBe('from-original');
  });

  it('warns when Metro cannot be resolved', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    withTreeShaking({ projectRoot: path.parse(repoRoot).root });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not resolve metro'));
    warn.mockRestore();
  });
});

describe('compareVersions', () => {
  it('orders versions numerically and ignores prerelease tags', () => {
    expect(compareVersions('0.87.1', '0.88.0')).toBeLessThan(0);
    expect(compareVersions('0.100.0', '0.88.0')).toBeGreaterThan(0);
    expect(compareVersions('0.86.0-rc.1', '0.86.0')).toBe(0);
  });
});
