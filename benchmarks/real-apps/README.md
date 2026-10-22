# Real apps

How the numbers in [docs/real-apps-results.md](../../docs/real-apps-results.md) were produced, and two tools to check `metro-tree-shaker` on any app.

## Tools

- [`getters-read.metro.config.cjs`](getters-read.metro.config.cjs): wraps the app's `metro.config.js` and writes which `react-native` getters the app reads (and which it doesn't) to `$OUT`, then stops the build.
- [`audit-unread-getters.mjs`](audit-unread-getters.mjs): checks a shaken bundle for any unread getter that is still read from `react-native`. Exits non-zero if it finds one.
- [`audit-requires.mjs`](audit-requires.mjs): checks a minified bundle for requires of modules it doesn't define (which throw "Requiring unknown module" when they run), reading only the bundle and its source map. react-native's entry is expected to show up after getter shaking. Exits non-zero for anything else.
- [`compare-module-init.mjs`](compare-module-init.mjs): loads a plain and a shaken bundle of the same app in Node with native modules stubbed, initializes every module the shaken bundle kept, in the same order in both, and lists modules that fail in one bundle but not the other. Code that needs a device fails the same way in both and cancels out. It only covers module initialization, not code that runs later, such as on render or a tap.

Limits: `getters-read.metro.config.cjs` needs a CLI that passes `--config` to Metro (the React Native CLI and Rock do; Expo CLI doesn't, so wrap the config in the app's `metro.config.js` instead). `audit-unread-getters.mjs` needs a minified bundle with one module per line, which is what `--minify true` produces; Xcode's default bundle isn't minified.

From the app's directory, with this repo built (`npm run build`):

```bash
OUT=getters.json npx react-native bundle --config <repo>/benchmarks/real-apps/getters-read.metro.config.cjs --entry-file index.js --platform ios --dev false --bundle-output /tmp/ignored.js
```

```bash
node <repo>/benchmarks/real-apps/audit-unread-getters.mjs getters.json <shaken-bundle.js>
```

```bash
node <repo>/benchmarks/real-apps/audit-requires.mjs <shaken-bundle.js> <shaken-bundle.js.map>
```

```bash
node --max-old-space-size=8192 <repo>/benchmarks/real-apps/compare-module-init.mjs <plain.js> <plain.js.map> <shaken.js> <shaken.js.map>
```

## Apps

| App | Commit | React Native | Metro | Dependencies |
|---|---|---|---|---:|
| [Rocket.Chat](https://github.com/RocketChat/Rocket.Chat.ReactNative) | `408d584` | 0.86.3 | 0.84.6 | 119 |
| [Expensify](https://github.com/Expensify/App) | `bc54f60` | 0.86.0 | 0.84.5 | 141 |

### Rocket.Chat

```bash
git clone https://github.com/RocketChat/Rocket.Chat.ReactNative.git rocketchat && git -C rocketchat checkout 408d584
```

Install with pnpm 10.33.4 (`npx -y pnpm@10.33.4 install --frozen-lockfile`). One git-hosted dependency (`@rocket.chat/mobile-crypto`) runs `yarn install` while it's prepared, so Yarn 1 must be on `PATH`.

Bundles were made with `npx react-native bundle --entry-file index.js --platform ios --dev false --minify true --reset-cache`, adding `--config <repo>/benchmarks/phase0/with-tree-shaking.metro.config.cjs` for the shaken build.

The Expo comparison needed [`rocketchat-clone.patch`](../reports/real-apps/rocketchat-clone.patch), active only when `USE_EXPO_METRO=1`:

1. use `expo/metro-config`'s `getDefaultConfig`;
2. add `cjs` to `sourceExts` (`superstruct` resolves to a `.cjs` file under Expo's resolver settings);
3. flatten the Babel config's `overrides` (Expo's transformer loads the config without a filename, which Babel rejects for `exclude` patterns);
4. with `NO_REACT_COMPILER=1`, leave out `babel-plugin-react-compiler` (with it, Expo's tree shaking fails with `DataCloneError: Symbol() could not be cloned`).

Then `npx expo export:embed` with the same flags, with and without `EXPO_UNSTABLE_TREE_SHAKING=1 EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1`.

### Expensify

```bash
git clone https://github.com/Expensify/App.git expensify && git -C expensify checkout bc54f60
```

The repo requires Node 26 and Bun for its install scripts. With Node 24 instead: `npm ci --ignore-scripts --engine-strict=false`, then apply its patches by copying every `patches/**/*.patch` into one directory and running `node_modules/.bin/patch-package --patch-dir <that directory>` (this is what its `applyPatches.ts` does).

Expensify's standalone app bundles with Re.Pack by default; Metro is used when `BUNDLER=metro` (its hybrid app builds). All builds used `ENVIRONMENT=production ENVFILE=.env.production npx rock bundle --entry-file index.js --platform ios --dev false --minify true --reset-cache`:

- Metro: `BUNDLER=metro`.
- Metro with `metro-tree-shaker`: also `METRO_TREE_SHAKER=1`, read by the block [`expensify-clone.patch`](../reports/real-apps/expensify-clone.patch) appends to `metro.config.js`. It wraps the final config, including Sentry's serializer.
- Re.Pack: without `BUNDLER`.

### Measuring

`shake-report stats <bundle> --map <map> --hermesc <app>/node_modules/hermes-compiler/hermesc/osx-bin/hermesc --json <out>`. [`phase0/shakeable-surface.mjs`](../phase0/shakeable-surface.mjs) groups a report's bytes by whether an ESM shaker could act on them.
