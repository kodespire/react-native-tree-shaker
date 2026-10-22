import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type Platform = 'ios' | 'android';

export interface AppConfig {
  name: string;
  /** App root, relative to the config file. */
  root: string;
  /** Default: `index.js`. */
  entry?: string;
  /** Default: both. */
  platforms?: Platform[];
  /** Path to `hermesc`, relative to the config file. Auto-detected when omitted; Hermes size is skipped if none is found. */
  hermesc?: string;
}

export interface VariantConfig {
  name: string;
  description?: string;
  /**
   * Shell command run in the app root. Placeholders, replaced with
   * shell-quoted absolute paths: {entry} {platform} {bundle} {map} {appRoot}
   */
  command: string;
  env?: Record<string, string>;
  /** Only run for these apps (by name). Default: all apps. */
  apps?: string[];
}

export interface BenchConfig {
  /** Where reports are written, relative to the config file. Default: `results`. */
  outDir?: string;
  apps: AppConfig[];
  /** For each app, the first variant that applies to it is the baseline the others are compared against. */
  variants: VariantConfig[];
}

export interface ResolvedConfig extends BenchConfig {
  outDir: string;
  /** Directory of the config file; relative paths resolve against it. */
  baseDir: string;
}

export async function loadConfig(configPath: string): Promise<ResolvedConfig> {
  const raw = JSON.parse(await readFile(configPath, 'utf8')) as BenchConfig;
  const baseDir = path.dirname(path.resolve(configPath));
  validate(raw, configPath);
  return { ...raw, baseDir, outDir: path.resolve(baseDir, raw.outDir ?? 'results') };
}

function validate(config: BenchConfig, source: string) {
  const fail = (message: string): never => {
    throw new Error(`${source}: ${message}`);
  };
  if (!Array.isArray(config.apps) || config.apps.length === 0) fail('`apps` must be a non-empty array');
  if (!Array.isArray(config.variants) || config.variants.length === 0) fail('`variants` must be a non-empty array');

  const appNames = new Set<string>();
  for (const app of config.apps) {
    if (!app.name || !app.root) fail('every app needs `name` and `root`');
    if (appNames.has(app.name)) fail(`duplicate app name "${app.name}"`);
    appNames.add(app.name);
    for (const platform of app.platforms ?? []) {
      if (platform !== 'ios' && platform !== 'android') fail(`app "${app.name}": unknown platform "${platform}"`);
    }
  }

  const variantNames = new Set<string>();
  for (const variant of config.variants) {
    if (!variant.name || !variant.command) fail('every variant needs `name` and `command`');
    if (variantNames.has(variant.name)) fail(`duplicate variant name "${variant.name}"`);
    variantNames.add(variant.name);
    for (const app of variant.apps ?? []) {
      if (!appNames.has(app)) fail(`variant "${variant.name}" lists unknown app "${app}"`);
    }
  }
}
