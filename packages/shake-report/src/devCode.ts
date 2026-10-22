import path from 'node:path';

/** Files only development builds should contain. */
const DEVELOPMENT_FILES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(?:^|[\\/])node_modules[\\/]react-devtools-core[\\/]/, label: 'react-devtools-core' },
  { pattern: /(?:^|[\\/])node_modules[\\/](react|react-reconciler|scheduler|react-is|react-test-renderer)[\\/]cjs[\\/][^\\/]*\.development\.js$/, label: '' },
];

export interface DevelopmentCode {
  /** Package name, or the file for React's development builds. */
  label: string;
  files: number;
  bytes: number;
}

/**
 * Development-only code in a production bundle, from module or source map
 * file paths: React DevTools, and React's
 * `*.development.js` builds. They usually mean `process.env.NODE_ENV` wasn't
 * inlined, so both the production and the development build are bundled.
 */
export function findDevelopmentCode(modules: Iterable<{ path: string; bytes: number }>): DevelopmentCode[] {
  const found = new Map<string, DevelopmentCode>();
  for (const { path: file, bytes } of modules) {
    for (const { pattern, label } of DEVELOPMENT_FILES) {
      const match = file.match(pattern);
      if (!match) continue;
      const key = label || `${match[1]}/cjs/${path.basename(file)}`;
      const entry = found.get(key) ?? { label: key, files: 0, bytes: 0 };
      entry.files++;
      entry.bytes += bytes;
      found.set(key, entry);
    }
  }
  return [...found.values()].sort((a, b) => b.bytes - a.bytes);
}
