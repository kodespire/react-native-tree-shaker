# Benchmarks

Builds each app with each bundler variant, then records size with [`shake-report`](../packages/shake-report): raw, gzip, brotli, Hermes bytecode, module count, and bytes per package.

Results: [Phase 0](../docs/phase0-results.md) (what existing shakers save), [Phase 1](../docs/phase1-results.md) (react-native getter shaking), [real apps](../docs/real-apps-results.md) and [Phase 3](../docs/phase3-results.md) (general shaking). Raw reports are in [`reports/`](reports). They were recorded before the project was renamed, so their logs and configs still say `metro-tree-shaker` and `METRO_TREE_SHAKER`.

## Phase 0 apps

[`phase0/setup.sh`](phase0/setup.sh) creates the apps used for Phase 0, with pinned versions, and writes `benchmarks/bench.config.json` for them:

```bash
benchmarks/phase0/setup.sh <apps-dir> [results-dir]
```

- `rn-template`: the bare React Native CLI template (stock Metro).
- `expo-default`: Expo's default template (expo-router, tabs).
- `expo-barrels`: Expo's blank template plus `date-fns`, `lodash-es` and `lucide-react-native`, imported through their package-level barrels ([`App.tsx`](phase0/expo-barrels.App.tsx)).
- `bare-expo-preset`: `rn-template` bundled with Expo's toolchain (`expo`, `expo/metro-config`, `babel-preset-expo`).
- `bare-expo`: the same without `babel-preset-expo`, a misconfiguration kept for comparison.

The generated config builds every app with stock bundling, with Expo's shaker where it applies, and with `react-native-tree-shaker` (`rn-cli-getters`, `expo-getters`, `expo-tree-shaking-getters`). The React Native CLI takes a Metro config path, so `rn-cli-getters` passes [`phase0/with-tree-shaking.metro.config.cjs`](phase0/with-tree-shaking.metro.config.cjs). Expo CLI ignores `--config` for Metro, so `setup.sh` gives each Expo app a `metro.config.js` that applies `withTreeShaking` only when `REACT_NATIVE_TREE_SHAKER=1`.

Keep `<apps-dir>` outside the repo; the apps need about 2 GB of `node_modules` (less on APFS, where the two bare copies are clones). The script records exact versions in `<apps-dir>/versions.txt`.

## React Native getter analysis

[`phase0/react-native-getters.mjs`](phase0/react-native-getters.mjs) measures how much of a bundle is reachable only through getters on `react-native`'s entry object, and how much of that the app never reads. It needs the module graph from a production build, which [`phase0/capture-graph.metro.config.cjs`](phase0/capture-graph.metro.config.cjs) writes. From the repo root, with `APPS` set to your apps directory:

```bash
npm run build
```

```bash
(cd "$APPS/rn-template" && APP_ROOT="$PWD" GRAPH_OUT=/tmp/rn-template-ios.graph.json npx react-native bundle --config "$OLDPWD/benchmarks/phase0/capture-graph.metro.config.cjs" --entry-file index.js --platform ios --dev false --minify true --reset-cache --bundle-output /tmp/graph-capture.bundle.js)
```

```bash
node benchmarks/phase0/react-native-getters.mjs /tmp/rn-template-ios.graph.json --json rn-template-ios.json
```

The script parses Flow with the app's own `hermes-parser`. Set `WHY=<path suffix>` to print the import chain that keeps a module.

## Setup for other apps

1. Put the apps to measure outside this repo (for example in `../bench-apps/`), with dependencies installed.
2. Copy the example config. The copy is gitignored.

   ```bash
   cp benchmarks/bench.config.example.json benchmarks/bench.config.json
   ```

3. Edit `root` paths (relative to the config file) and variants.

## Run

```bash
npm run build
```

```bash
npm run bench -- --dry-run
```

```bash
npm run bench
```

Filter with `--app`, `--variant` and `--platform` (each can repeat).

Output goes to `<outDir>/<app>/<platform>/<variant>.{bundle.js,bundle.js.map,hbc,json}`, plus `summary.md`. For each app and platform, the summary lists every variant's sizes and build time, then compares each variant with the first one that ran for that app. Build time is the wall-clock time of the variant's command, so pass `--reset-cache` (as the Phase 0 config does) to measure cold builds.

## Config

| Field | Meaning |
|---|---|
| `apps[].root` | App directory, relative to the config file |
| `apps[].entry` | Entry file, default `index.js` |
| `apps[].platforms` | Default `["ios", "android"]` |
| `apps[].hermesc` | Path to `hermesc`. When omitted it is looked up in the app (CocoaPods `hermes-engine`, the `hermes-compiler` package, `react-native/sdks/hermesc`). Without one, Hermes size is skipped. |
| `variants[].command` | Shell command run in the app root. Placeholders `{entry}` `{platform}` `{bundle}` `{map}` `{appRoot}` are replaced with shell-quoted absolute paths. |
| `variants[].env` | Extra environment variables |
| `variants[].apps` | Limit the variant to these apps |

For each app, the first variant that applies to it is its baseline.

## Not covered yet

- **Cold-start time.** It needs a device or emulator; measure by hand for now.
- **rnx-kit and Re.Pack.** Both need per-app bundler configuration, so add them as variants once an app is set up for them.
