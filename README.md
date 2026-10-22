# react-native-tree-shaker

Tree shaking for React Native's [Metro](https://github.com/facebook/metro) bundler: remove unused exports and modules from production bundles, without switching bundlers and without depending on Expo CLI.

> **Status: pre-alpha.** It removes unused exports, and the modules only they needed, across an app and its dependencies, plus the parts of `react-native` the app never uses. On Rocket.Chat that cuts Hermes bytecode by 9.7%, with React Compiler on (Expo's tree shaking: 7.0%, with it off); on Expensify by 3.6%; on Expo's default template by 18.3% (Expo's: 12.2%) ([results](docs/phase3-results.md)). Both shaken apps build and load the same as unshaken ones in a stubbed runtime, but neither has run on a device yet. Supports Metro 0.82–0.87 (React Native 0.79–0.88).

## Why

Metro converts each module from ESM to CommonJS and minifies it **one file at a time** in its transform workers. The serializer is the only stage that sees the whole module graph, and by then `export const foo` has already become `exports.foo = …`. A minifier can't prove a property assignment is unused, so unused exports ship.

Expo's experimental shaker solves this by moving the ESM-to-CommonJS step and minification after whole-graph analysis, which needs Expo CLI and `babel-preset-expo`. `react-native-tree-shaker` instead reads the imports and exports back out of Metro's normal output, in the serializer, removes what nothing reads, and re-minifies only the modules it changed. So it works with any Metro setup and Babel config, React Compiler included, and keeps Metro's transform cache. It also adds the React Native-specific pieces generic shakers skip. Details are in [docs/architecture.md](docs/architecture.md), and how this compares to Expo, rnx-kit and Re.Pack is in [docs/prior-art.md](docs/prior-art.md).

## Packages

| Package | What it is | State |
|---|---|---|
| [`react-native-tree-shaker`](packages/react-native-tree-shaker) | `withTreeShaking(config)` for `metro.config.js` | General shaking (Phase 3) and `react-native` getter shaking (Phase 1) |
| [`@react-native-tree-shaker/shake-report`](packages/shake-report) | Bundle size analysis: raw/gzip/brotli/Hermes bytecode size, module count, bytes per package from source maps, development-only code, and diffs | Working |
| [`@react-native-tree-shaker/babel-plugin-optimize-barrels`](packages/babel-plugin-optimize-barrels) | Rewrites barrel imports to direct module imports | Stub (Phase 2) |
| [`@react-native-tree-shaker/side-effects-db`](packages/side-effects-db) | `sideEffects` resolution with webpack semantics, plus a curated override list for RN libraries | Resolution works; dataset intentionally empty |
| [`benchmarks/`](benchmarks) | Builds each app with each bundler variant and compares sizes | Working |
| [`fixtures/`](fixtures) | ESM/CommonJS interop corpus with expected shaking results | All cases run end to end, in both of Metro's output dialects |

## Usage

```js
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withTreeShaking } = require('react-native-tree-shaker');

module.exports = withTreeShaking(mergeConfig(getDefaultConfig(__dirname), {}));
```

Shaking runs only for production bundles (`--dev false`). Development builds and Fast Refresh are untouched. Details and limits: [packages/react-native-tree-shaker](packages/react-native-tree-shaker).

## Development

```bash
npm install
```

```bash
npm run build
```

```bash
npm test
```

Requires Node 22 or newer to develop. The published packages target Node 20.19+, matching React Native.

## License

MIT
