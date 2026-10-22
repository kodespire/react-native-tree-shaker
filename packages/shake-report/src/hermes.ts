import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Looks for `hermesc` the way React Native's own build scripts do. Its location
 * has moved between versions, so callers should also accept an explicit path.
 */
export function findHermesc(appRoot: string): string | undefined {
  const platformDir = { darwin: 'osx-bin', linux: 'linux64-bin', win32: 'win64-bin' }[process.platform as string];
  if (!platformDir) return undefined;
  const binary = process.platform === 'win32' ? 'hermesc.exe' : 'hermesc';

  const candidates: string[] = [];
  if (process.platform === 'darwin') {
    // CocoaPods builds compile with the hermesc that matches the bundled VM.
    candidates.push(path.join(appRoot, 'ios/Pods/hermes-engine/destroot/bin/hermesc'));
  }
  const reactNativeDir = resolvePackageDir('react-native', appRoot);
  if (reactNativeDir) {
    // Newer versions depend on the `hermes-compiler` package.
    const compilerDir = resolvePackageDir('hermes-compiler', reactNativeDir);
    if (compilerDir) candidates.push(path.join(compilerDir, 'hermesc', platformDir, binary));
    // Older versions ship it inside react-native.
    candidates.push(path.join(reactNativeDir, 'sdks/hermesc', platformDir, binary));
  }
  return candidates.find((candidate) => existsSync(candidate));
}

/** Compiles a bundle to Hermes bytecode with the flags React Native release builds use. */
export async function compileHermes({ hermesc, input, output }: { hermesc: string; input: string; output: string }): Promise<void> {
  await execFileAsync(hermesc, ['-emit-binary', '-max-diagnostic-width=80', '-O', '-out', output, input], {
    maxBuffer: 64 * 1024 * 1024,
  });
}

function resolvePackageDir(name: string, from: string): string | undefined {
  try {
    return path.dirname(createRequire(path.join(from, 'package.json')).resolve(`${name}/package.json`));
  } catch {
    return undefined;
  }
}
