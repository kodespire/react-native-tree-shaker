# Phase 0 results

October 2026. How much does tree shaking save in React Native apps today, and what does it take to get it?

## Setup

| | |
|---|---|
| Versions | React Native 0.88.0, Expo SDK 58 (`expo` 58.0.16), Metro 0.87.1, `hermes-compiler` 260318099.0.4, Node 24.19.0, macOS |
| Build | Production bundle (`--dev false --minify true --reset-cache`), then `hermesc -emit-binary -O`, as release builds do |
| Measured | Raw, gzip, brotli and Hermes bytecode size, module count, bytes per package, cold build time |
| Reproduce | Sizes: [`benchmarks/phase0/setup.sh`](../benchmarks/phase0/setup.sh), then `npm run build` and `npm run bench`. Getter analysis: see [benchmarks/README.md](../benchmarks/README.md#react-native-getter-analysis) |
| Raw data | [`benchmarks/reports/phase0/`](../benchmarks/reports/phase0) |

Apps:

| App | What it is |
|---|---|
| `rn-template` | Bare React Native CLI template, stock Metro |
| `expo-default` | Expo's default template (expo-router, tabs): a typical new Expo app |
| `expo-barrels` | Expo's blank template importing a few names from `date-fns`, `lodash-es` and `lucide-react-native` through their barrel files. **Best case by construction.** |
| `bare-expo-preset` | `rn-template` adopting Expo's bundling toolchain: `expo`, `expo/metro-config` and `babel-preset-expo` |
| `bare-expo` | Same, but keeping `@react-native/babel-preset`. A misconfiguration, kept as a warning (see finding 4) |

Variants: `rn-cli` (`react-native bundle`), `expo` (`expo export:embed`, shaking off) and `expo-tree-shaking` (the same with `EXPO_UNSTABLE_TREE_SHAKING=1 EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1`). Expo CLI logged "Experimental tree shaking is enabled" on every shaken build.

## Results

Hermes bytecode on iOS. Android bundles are 0.4–6% larger (`expo-default` is the 6%), but the change from shaking is within half a percentage point of iOS for every app. See [`summary.md`](../benchmarks/reports/phase0/summary.md).

| App | Without shaking | With Expo's shaker | Change | Cold build, run 1 | Cold build, run 2 |
|---|---:|---:|---:|---:|---:|
| `rn-template` (stock Metro) | 1227.3 KiB | — | — | 2.8 s | 3.7 s |
| `expo-default` | 3539.1 KiB | 3106.2 KiB | **−12.2%** | 6.9 → 12.1 s | 8.4 → 14.8 s |
| `expo-barrels` | 4537.8 KiB | 1750.5 KiB | **−61.4%** | 5.5 → 12.6 s | 8.1 → 18.9 s |
| `bare-expo-preset` | 1266.5 KiB | 1231.4 KiB | **−2.8%** | 2.9 → 5.5 s | 4.2 → 7.3 s |
| `bare-expo` (wrong preset) | 2198.1 KiB | 2198.1 KiB | 0.0% | 4.6 → 10.1 s | 6.3 → 13.2 s |

## Findings

1. **Expo's shaker works on iOS and Android and saves real bytes in Expo apps.** On the default template it cuts Hermes bytecode by 12%. Most of that is `react-native-reanimated` (625 → 396 KiB) and `semver`, which disappears entirely.

2. **Barrel-heavy libraries are where shaking pays most.** `lucide-react-native` goes from 1.53 MiB to 6.8 KiB, `lodash-es` drops 87% and `date-fns` 85%. The whole bundle loses 61% of its bytecode. This app was built to show the best case, so don't read it as typical.

3. **Shaking roughly doubles cold build time** (×1.7 to ×2.7 across both runs and platforms). Expo's docs say why: transforms are delayed until the whole graph is built, which defeats per-file caching.

4. **A bare app can use Expo's shaker, but only by adopting Expo's bundling toolchain.** That means installing `expo`, switching to `expo/metro-config`, adding `babel-preset-expo` as a direct dependency (npm nests it under `expo`, where Babel can't find it), and building release bundles with `expo export:embed`, so the native build scripts change too. On the bare template that buys 2.8%.
   - Switching only `metro.config.js` is worse than nothing. The bundle grows 76% because `__DEV__` and `NODE_ENV` stop being inlined, so `react-devtools-core` and React's development build ship. Shaking then saves 0 bytes, because `@react-native/babel-preset` has already converted every module to CommonJS.

5. **Nobody shakes `react-native` itself, and it is most of a small app.** It is 77% of the bare template's JavaScript (667 of 865 KiB). Expo's shaker trims it by 3% (about 18 KiB) in every app, because its entry file is a CommonJS object of lazy `require()` getters that ESM shaking can't see into.
   - [`react-native-getters.mjs`](../benchmarks/phase0/react-native-getters.mjs) measured this on the template (iOS) from Metro's module graph: 341 KiB, 40% of all module code, is reachable **only** through those getters.
   - The app and its libraries read 17 of the 96 getters. No file uses the module object in a way the analysis couldn't follow, such as a spread or a computed key.
   - Dropping the unread getters would remove **100 modules: 107 KiB of minified JS module code, 12.6% of the total and 15% of `react-native`.** About 8% of that is Metro's per-module wrapper, so expect roughly 98 KiB off the final bundle.
   - **It adds to Expo's shaker rather than overlapping it.** All 100 modules ship in the Expo-toolchain build of the same app (`bare-expo-preset`), and 89 of them (99.8 KiB) are still there after Expo's shaker. In the same units, Expo's shaker saved 24.7 KiB of raw JS on that app, so getter dropping is worth roughly 4× as much.
   - The removed code never runs anyway, because getters are lazy. The gain is download and update size, not startup time.
   - Why `react-native` measures 592 KiB under Expo's toolchain but 667 KiB under stock Metro, before any shaking: both builds contain the same `react-native` files. `babel-preset-expo` simply downlevels less (it keeps 110 class declarations where the stock preset keeps 2, and inlines no `@babel/runtime` helpers), so each file comes out about 11% smaller.

6. **React Native has internal "everything" objects too.** `ScrollView` imports `ScrollViewStickyHeader`, which imports `Animated`, whose export object includes `AnimatedFlatList`, which pulls in `FlatList` and all of `@react-native/virtualized-lists`. So any app that uses `ScrollView` ships the list implementations. Object-shaped exports like this are invisible to ESM shakers as well. Full trace: [`rn-template-ios.txt`](../benchmarks/reports/phase0/react-native-getters/rn-template-ios.txt).

7. **Shaking sometimes makes a package bigger.** `react-native-svg` grew 11.8 KiB and `@expo/ui` 1.9 KiB in the shaken builds. Not investigated yet; the likely cause is different output from Expo's second transform pass.

## Caveats

- **Shaken bundles were not executed.** The savings assume Expo's output still runs correctly.
- **Sizes are deterministic** (a second full run reproduced them). **Build times are from two runs on one machine**, so treat them as indicative.
- **The getter analysis covers one app on one platform.** "Getters read" is a static scan for names imported or member-accessed from `react-native`. Other apps may use the module object dynamically somewhere, and then every getter counts as used. Its byte counts are minified module code including Metro's per-module wrapper, about 8% more than what the source map attributes.
- **Not measured:** cold start, and a real mid-size production app.
- **No threshold was set before the results came in**, so this is not a pass or fail against the roadmap's decision gate.

## What this suggests

Proposed after seeing the data, for discussion:

- **For Expo apps,** a general ESM shaker already exists and works. Rebuilding it (now roadmap Phase 3) would add little.
- **For bare apps,** today's alternative is adopting Expo's toolchain, which costs config and native build-script changes and, on the template, buys 2.8%.
- **The opening nobody covers is `react-native` itself:** unread getters (about 100 KiB on the template) and internal export objects such as `Animated`. Dropping unread getters is narrower than general shaking. It rewrites one module (`react-native/index.js`) at serialization time, removes the modules only it reached, and needs no ESM-preserving transformer. It would help bare and Expo apps alike, so it could ship before general ESM shaking, not after. (It did: roadmap Phase 1, [results](phase1-results.md).)
- **The risk is different from general shaking.** Missing one getter read doesn't just leave extra bytes: that code gets `undefined` at runtime and crashes. This analysis scanned original sources; a shaker in the serializer sees transformed output and must detect every access there, and fall back to keeping every getter whenever it can't.
