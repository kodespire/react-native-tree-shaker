import path from 'node:path';
import type { AppConfig, Platform, ResolvedConfig, VariantConfig } from './config';

export interface Run {
  app: AppConfig;
  appRoot: string;
  platform: Platform;
  variant: VariantConfig;
  /** Output paths, absolute. */
  files: { bundle: string; map: string; hbc: string; report: string };
  command: string;
}

export interface PlanFilter {
  apps?: string[];
  variants?: string[];
  platforms?: Platform[];
}

/** Expands the config into one run per app × platform × variant. */
export function planRuns(config: ResolvedConfig, filter: PlanFilter = {}): Run[] {
  const runs: Run[] = [];
  for (const app of config.apps) {
    if (filter.apps && !filter.apps.includes(app.name)) continue;
    const appRoot = path.resolve(config.baseDir, app.root);

    for (const platform of app.platforms ?? ['ios', 'android']) {
      if (filter.platforms && !filter.platforms.includes(platform)) continue;

      for (const variant of config.variants) {
        if (filter.variants && !filter.variants.includes(variant.name)) continue;
        if (variant.apps && !variant.apps.includes(app.name)) continue;

        const prefix = path.join(config.outDir, app.name, platform, variant.name);
        const files = {
          bundle: `${prefix}.bundle.js`,
          map: `${prefix}.bundle.js.map`,
          hbc: `${prefix}.hbc`,
          report: `${prefix}.json`,
        };
        const command = renderCommand(variant.command, {
          entry: path.resolve(appRoot, app.entry ?? 'index.js'),
          platform,
          bundle: files.bundle,
          map: files.map,
          appRoot,
        });
        runs.push({ app, appRoot, platform, variant, files, command });
      }
    }
  }
  return runs;
}

/** Replaces `{name}` placeholders with shell-quoted values. Unknown placeholders are an error. */
export function renderCommand(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in values)) throw new Error(`Unknown placeholder ${match} in command: ${template}`);
    return shellQuote(values[name]);
  });
}

function shellQuote(value: string): string {
  return /^[\w./:@%+=-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}
