// Prints the Phase 0 bench config for apps created by setup.sh.
// Usage: node write-config.mjs <apps-dir> <results-dir>
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const [appsDir, outDir] = process.argv.slice(2);

/**
 * The app's entry file: package.json `main` as a file in the app (`index.ts`)
 * or as a package path (`expo-router/entry`), else index.js.
 */
function entryOf(appRoot) {
  const { main } = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  if (!main) return 'index.js';
  if (existsSync(path.resolve(appRoot, main))) return path.relative(appRoot, path.resolve(appRoot, main));
  return path.relative(appRoot, createRequire(path.join(appRoot, 'package.json')).resolve(main));
}

const app = (name) => {
  const root = path.join(appsDir, name);
  return { name, root, entry: entryOf(root), platforms: ['ios', 'android'] };
};

const bundleFlags =
  '--entry-file {entry} --platform {platform} --dev false --minify true --reset-cache --bundle-output {bundle} --sourcemap-output {map}';
const expoEnv = { CI: '1', EXPO_NO_TELEMETRY: '1' };
const expoShaking = { EXPO_UNSTABLE_TREE_SHAKING: '1', EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: '1' };
// The React Native CLI takes a Metro config path: the app's config wrapped with
// withTreeShaking. Quoted: repo paths may contain spaces. Expo CLI ignores
// --config, so Expo apps' metro.config.js (from setup.sh) reads REACT_NATIVE_TREE_SHAKER.
const withShaker = `--config '${path.join(import.meta.dirname, 'with-tree-shaking.metro.config.cjs')}'`;
const expoWithShaker = { ...expoEnv, REACT_NATIVE_TREE_SHAKER: '1' };
const gettersOnly = { REACT_NATIVE_TREE_SHAKER_EXPORTS: '0' };

const expoApps = ['expo-default', 'expo-barrels', 'bare-expo', 'bare-expo-preset'];

const config = {
  outDir,
  apps: [app('rn-template'), ...expoApps.map(app)],
  variants: [
    {
      name: 'rn-cli',
      description: 'Stock Metro through the React Native CLI.',
      command: `npx react-native bundle ${bundleFlags}`,
      apps: ['rn-template'],
    },
    {
      name: 'expo',
      description: 'Expo CLI, tree shaking off. This is the command native Expo builds run.',
      command: `npx expo export:embed ${bundleFlags}`,
      env: expoEnv,
      apps: expoApps,
    },
    {
      name: 'expo-tree-shaking',
      description: "Expo CLI with Expo's experimental tree shaking.",
      command: `npx expo export:embed ${bundleFlags}`,
      env: { ...expoEnv, ...expoShaking },
      apps: expoApps,
    },
    {
      name: 'rn-cli-getters',
      description: "Stock Metro plus react-native-tree-shaker's react-native getter shaking only.",
      command: `npx react-native bundle ${withShaker} ${bundleFlags}`,
      env: gettersOnly,
      apps: ['rn-template'],
    },
    {
      name: 'rn-cli-shaker',
      description: 'Stock Metro plus react-native-tree-shaker: getter shaking and general shaking.',
      command: `npx react-native bundle ${withShaker} ${bundleFlags}`,
      apps: ['rn-template'],
    },
    {
      name: 'expo-getters',
      description: "Expo CLI plus react-native-tree-shaker's react-native getter shaking only.",
      command: `npx expo export:embed ${bundleFlags}`,
      env: { ...expoWithShaker, ...gettersOnly },
      apps: expoApps,
    },
    {
      name: 'expo-shaker',
      description: 'Expo CLI plus react-native-tree-shaker: getter shaking and general shaking.',
      command: `npx expo export:embed ${bundleFlags}`,
      env: expoWithShaker,
      apps: expoApps,
    },
    {
      name: 'expo-tree-shaking-getters',
      description: "Expo's tree shaking and react-native-tree-shaker together. General shaking steps aside for Expo's.",
      command: `npx expo export:embed ${bundleFlags}`,
      env: { ...expoWithShaker, ...expoShaking },
      apps: expoApps,
    },
  ],
};

process.stdout.write(JSON.stringify(config, null, 2) + '\n');
