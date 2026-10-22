# react-native-tree-shaker

Tree shaking for React Native's Metro bundler.

> **Pre-alpha.** It removes exports nothing imports, and the modules only they needed, across your app and its dependencies, plus the parts of `react-native` your app never uses. See the [roadmap](../../docs/roadmap.md).

```js
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withTreeShaking } = require('react-native-tree-shaker');

module.exports = withTreeShaking(mergeConfig(getDefaultConfig(__dirname), {}));
```

Each production bundle prints a summary:

```
[react-native-tree-shaker] react-native getters: 54 of 98 read; removed 48 modules (26.9 KiB).
[react-native-tree-shaker] exports: removed 3057 unused exports and 560 modules, 1212.8 KiB (9.0% of module code), in 8 rounds, 14.3 s. 912 modules' exports couldn't be analyzed.
```

It works on Metro's normal transform output, after Babel. There is no transformer to install, so it works with any Babel config (React Compiler included), keeps Metro's transform cache, and runs the same under the React Native CLI, Rock and Expo CLI.

## Results

| App | Hermes bytecode | Modules |
|---|---:|---:|
| [Rocket.Chat](https://github.com/RocketChat/Rocket.Chat.ReactNative) (React Compiler on) | −9.7% | −608 |
| Expo's default template | −18.3% | −251 |
| An Expo app importing from `lucide-react-native`, `lodash-es` and `date-fns` | −69.9% | −2,912 |
| [Expensify](https://github.com/Expensify/App) (Metro build) | −3.6% | −664 |

Details, including the template and Expo apps, how these compare with Expo's tree shaking, and what was and wasn't verified: [docs/phase3-results.md](../../docs/phase3-results.md). Neither app has run on a device with shaking yet.

## What it removes

**Unused exports, across the whole graph.** For every module, it reads which exports the module defines and which exports of its dependencies it reads, in both shapes ESM takes after Metro's transform (Babel's CommonJS output and Metro's own import support). An export nothing reads is removed, and the minifier then removes code only that export used. A module nothing requires anymore is dropped if its package declares it free of side effects. This repeats until nothing changes, because removing code can leave more exports unread. CommonJS modules that assign `exports.x = …` are shaken the same way.

**Unused parts of `react-native`.** Its entry file is an object of lazy getters (`get View() { return require('./Libraries/...') }`), so every component and API it lists ships, even though only the ones your code reads ever run. Modules reachable only through getters nobody reads are removed. `react-native/index.js` itself isn't rewritten: if something did read a removed getter, it would fail on that line with "Requiring unknown module".

Before shipping, it checks its own work: no kept module may require a removed one, and every export a kept module reads must still exist. If either check fails, the bundle is built unshaken and the summary says why. That check trusts the same analysis, so to check a shaken bundle independently, see [benchmarks/real-apps](../../benchmarks/real-apps): one script looks for dangling requires, another initializes every module of a plain and a shaken bundle in Node and compares.

## Side effects

A module whose exports are all unused is only dropped when it's known to have no side effects. That comes from, in order:

1. the `sideEffects` option;
2. the package's `sideEffects` field in `package.json` (same meaning as in webpack, globs included);
3. a curated list in [`side-effects-db`](../side-effects-db) (empty for now).

Anything else, including your app's own files when your `package.json` has no `sideEffects` field, is assumed to have side effects: the module stays, but its unused exports still go. Most React Native libraries don't declare `sideEffects`, so the option is where most extra savings are:

```js
module.exports = withTreeShaking(config, {
  sideEffects: { 'my-icon-library': false, 'my-ui-kit': ['./src/setup.js'] },
});
```

Only mark a package side-effect free if importing it for nothing must not run anything that matters: native module or component registration, polyfills and global setup all count as side effects.

## When it keeps things

What the analysis can't follow, it keeps, and the summary counts it:

- **A module's exports are kept** when it replaces `module.exports` (precompiled CommonJS), reads its own exports object, or uses a computed export name. What it reads from its own dependencies is still tracked.
- **All of a dependency's exports are kept** when an importer uses it in a way that could read anything: `ns[key]`, spreads, `Object.keys(ns)`, passing the module object to a function, `import * as ns` of a CommonJS module, or a dynamic `import()`.
- **react-native's getters are all kept** if any module uses react-native's exports object that way; the summary lists those files.

It also steps aside when:

- `unstable_inlineDependencyMap` or `dependencyMapReservedName` is set;
- Expo's own tree shaking (`EXPO_UNSTABLE_TREE_SHAKING`) is on: modules aren't transformed yet when serialization starts, and Expo shakes them itself;
- for getter shaking, `react-native` isn't at `node_modules/react-native/index.js` (for example out-of-tree platforms).

## Options

| Option | Default | Description |
|---|---|---|
| `enabled` | `true` | Set to `false` to keep the wrapper installed but never shake, for size comparisons. |
| `shakeExports` | `true` | Set to `false` for react-native getter shaking only. |
| `sideEffects` | `{}` | `sideEffects` per package name, overriding `package.json`: `false`, or a list of files (globs) that have side effects. |
| `keepReactNativeGetters` | `[]` | Getter names to keep even when no read is found, e.g. `['Animated']`, for code the analysis can't see. |
| `quiet` | `false` | Don't print the summary. |

## Behavior and limits

- **Production only.** When Metro serializes with `dev: true`, the serializer is a strict pass-through. Fast Refresh and the dev server are untouched.
- **Development code warning.** If a production bundle contains React's development builds or React DevTools (usually because `process.env.NODE_ENV` wasn't inlined), the summary warns, with sizes. That code isn't removed: it's what your config asked Metro to bundle.
- **Composes.** An existing `serializer.customSerializer` is wrapped, not replaced. Without one, Metro's default serializer is loaded from the app's own copy of Metro. Tested with Expo's serializer and Sentry's (its debug IDs survive in Expensify's shaken bundle); other wrappers are untested.
- **Never fails a build.** Any unexpected error skips that kind of shaking for that bundle and prints why.
- **Build time.** Changed modules are re-minified with the app's own minifier (two compress passes with terser). On Rocket.Chat and Expensify that added 9 and 23 seconds to a cold release bundle (17 → 28 s and 45 → 72 s), measured before the second pass, which adds some more.
- **Expo:** works with Expo CLI's `export:embed`, but only through the project's `metro.config.js`; Expo CLI doesn't apply `--config` to Metro.
- **Source maps** from the CLI (`--sourcemap-output`, which Xcode and Gradle builds use) map the shipped bundle back to your source. Source maps the dev server serves for `dev=false` bundles are still built from the full graph.
- **Assets** of removed modules are still copied, because Metro collects assets from the full graph.
- **Supported Metro:** `>=0.82.0 <0.88.0`, which covers React Native 0.79 to 0.88. Each minor is tested end to end (`npm run test:metro-versions`). A warning is printed at config time for other versions.
