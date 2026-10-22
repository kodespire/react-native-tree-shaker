# Roadmap

Reordered after [Phase 0](phase0-results.md). The measurements showed that a general ESM shaker already exists in Expo, while nothing shakes the `react-native` package itself, which is most of a small app. So `react-native`-specific shaking comes first.

## Phase 0: measure first ✅

Done October 2026: see [phase0-results.md](phase0-results.md). Still open: a real mid-size app, cold-start measurements, and the getter analysis on more apps.

- 3–5 apps: the React Native template, Expo's default template, a barrel-heavy app, and the template adopting Expo's toolchain.
- Built with the variants in [`benchmarks/`](../benchmarks); measured with `shake-report`.

## Phase 1: shake `react-native`'s getters ✅

**Shipped October 2026: see [phase1-results.md](phase1-results.md).** −11.1% Hermes bytecode on the template; verified in a Release build in the iOS Simulator. On two large real apps (Rocket.Chat, Expensify) it works and audits clean, but saves only 0.1–0.2%, because those apps use most of `react-native` ([real-apps-results.md](real-apps-results.md)). Still open: running a shaken real app on a device, and working alongside Expo's shaker (today it skips itself when `EXPO_UNSTABLE_TREE_SHAKING` is on).

`react-native`'s entry file is a CommonJS object of lazy getters (`get View() { return require(...) }`). Getters nobody reads keep their modules in the bundle even though they never run: about 100 KiB on the template.

In `react-native-tree-shaker`'s serializer, production builds only:

- find which getters the app reads by analyzing every module that imports `react-native`, in Metro's transformed output;
- drop the modules reachable only through unread getters, and return a source map for the bundle that ships;
- keep everything, with a one-line warning naming the file, whenever a read can't be followed (spread, computed key, `import *`, passing the module object around).

Works with the stock React Native CLI setup and with Expo CLI (through the project's `metro.config.js`).

## Phase 2: barrel-import rewriting

`@react-native-tree-shaker/babel-plugin-optimize-barrels`: rewrite `import { X } from 'big-lib'` to the module that defines `X`, by reading the library's re-exports at build time. It works with any bundler and in development. Its cache key must include the barrel files' contents.

General shaking now removes unused barrel re-exports from production bundles, so this phase's remaining value is development builds: fewer modules to transform and load in the dev server.

## Phase 3: general shaking ✅ (pre-alpha)

**Built October 2026: see [phase3-results.md](phase3-results.md).** −9.7% Hermes bytecode on Rocket.Chat (Expo's shaker: −7.0%, and only after disabling React Compiler) and −3.6% on Expensify, each with its own Babel config; −18.3% on Expo's default template (Expo's shaker: −12.2%). Design: [architecture.md](architecture.md#general-shaking-phase-3-shipped). It works on Metro's normal transform output in the serializer, so it needs no transformer and runs under the React Native CLI, Rock and Expo CLI.

Checked:

- every case in [`fixtures/`](../fixtures), in both of Metro's output dialects, with and without `inlineRequires`, on every supported Metro minor;
- shaken and unshaken real-app bundles initialize the same modules the same way in Node with native modules stubbed, and the shaken ones require no module they don't define.

Still open before beta:

- run a shaken large app on a device, and its end-to-end tests;
- populate `side-effects-db`, since most React Native libraries don't declare `sideEffects`;
- measure build time on more apps (shaking itself took 9–15 s on Rocket.Chat and 23–37 s on Expensify, in cold release builds).

What else could shrink bundles, measured: [further-reductions.md](further-reductions.md).

## Phase 4: more React Native-specific shaking

- Internal export objects, such as `Animated`, which pulls `FlatList` and the virtualized lists into every app that uses `ScrollView`.
- Populate `side-effects-db` with verified entries.
- Never remove native registration code.

## Phase 5: diagnostics

- Heavy-dependency report: the largest CommonJS libraries, locales and icon maps loaded up front. Development-only code in production bundles (found in Expensify's Metro build) is done: a build warning and a `shake-report` section.
- "Why was this module kept?" report.
- Size diffs in CI (a GitHub Action that fails when the bundle grows past a budget).

## Phase 6: upstream

Write an RFC for Metro and share findings with Expo.

## Support policy

Metro internals change often (0.85–0.87 changed import/export interop and the serializer's source-map format). Real apps lag behind React Native releases, so we support Metro 0.82–0.87 (React Native 0.79–0.88) and run the e2e tests against each minor with `npm run test:metro-versions`. The range is in `packages/react-native-tree-shaker/src/metroVersion.ts`.
