# How much further can bundles shrink?

October 2026. After [Phase 3](phase3-results.md), what is left in Rocket.Chat, Expensify and Expo's default template, and what each further step would save. Measured by running the shaker offline on each app's captured module graph and comparing minified module code (before Hermes), so the figures are relative, not Hermes bytecode.

## Headline

**Inside the shaker, two changes are worth it, and both matter for Expensify, not the other two apps:**

| Expensify, module code removed | |
|---|---:|
| Today | −3.3% |
| Recognize recent Babel's `interopRequireWildcard` (done, below) | −4.4% |
| Also fold `__DEV__` and `process.env.NODE_ENV` before shaking (prototype) | **−5.7%** |

**Most of what remains is outside a tree shaker's reach: data and code the app really uses, loaded up front.** Translations alone are 15% of Rocket.Chat's remaining module code and 24% of Expensify's.

## What is left after shaking

| | Rocket.Chat | Expensify | Expo default template |
|---|---:|---:|---:|
| Module code left | 11.9 MiB | 37.6 MiB | 1.25 MiB |
| App's own code | 20% | 74% | 2% |
| Dependencies, cut down to the exports used | 40% | 15% | 68% |
| JSON data | 20% | 1% | 7% |
| Dependencies read in full | 12% | 9% | 6% |
| Dependencies whose exports can't be analyzed | 7% | 1% | 17% |
| Kept only because they may have side effects | 1.4% | 0.3% | 0.6% |

## Findings

1. **Recent Babel's `import * as X` helper caches itself** by reassigning its own name on first call (`return (c = function (e, i) {…})(e, i)`). The analysis refused any reassigned helper, so every namespace import compiled by a recent Babel read its module in full: 2.3 MiB of ES-module code in Expensify. **Fixed**: a helper may now reassign itself inside its own body. Expensify −3.3% → −4.4%. No effect on the other two apps, which use an older form.
2. **Expensify ships React's and react-native's development builds** because its Babel config inlines neither `process.env.NODE_ENV` nor `__DEV__`, so `__DEV__ ? require(dev) : require(prod)` keeps both. In a production bundle, Metro's prelude sets `__DEV__ = false` and `NODE_ENV = "production"`, so the shaker could fold both values before analyzing. A prototype removes 523 KiB more (−4.4% → −5.7%). Apps whose config already inlines them (Rocket.Chat, Expo's template) are unaffected. Today the shaker only warns.
3. **Better side-effect information is worth less than it looks.** Assuming every dependency is free of side effects would remove 5.4 more points from Rocket.Chat, but most of what that removes really has side effects: react-native's startup setup, MathJax registering its TeX extensions, polyfills. Inferring side-effect freedom from each module's top-level code (only declarations, exports and requires of other such modules) finds 938 such modules but saves only 0.1 point, because the modules that matter run code at load. Not worth building now; declaring `sideEffects` per package stays the way to get more.
4. **Translations are the biggest single item, and a tree shaker can't remove them.**
   - Rocket.Chat bundles 25 locale JSON files: 1.8 MiB, 15% of its remaining module code.
   - Expensify bundles 14 language modules: 8.8 MiB, 24% (`el.ts` alone is 2.2 MiB). It loads them with `import()`, but Metro puts async imports in the main bundle, and they are used whole once loaded.

   Fetching translations on demand, or shipping only the default language in the bundle, is an app change. It would save more than everything above together.
5. **Duplicate packages.** Expensify bundles five copies of `entities`, and several of `htmlparser2`, `domutils` and `domhandler` (196 KiB extra). It also bundles both builds of `awesome-phonenumber` (254 KiB): its ES module through `import`, and its CommonJS build through `require`. A package manager `overrides`/`resolutions` entry and consistent resolver conditions fix these; the shaker can only report them. Rocket.Chat has 15 KiB of duplicates.
6. **Prebuilt single-file libraries** can't be shaken inside: `jsrsasign` (284 KiB), `@rocket.chat/message-parser` (244 KiB), `transliteration`'s UMD build (285 KiB). Metro picks `transliteration`'s `browser` build, though it also publishes an ES module (`module` field); adding `module` to `resolver.resolverMainFields` would make it shakeable, a small and app-specific gain.
7. **What stays because it's used**: KaTeX's inlined CSS and scripts (650 KiB), MathJax's font tables (600 KiB), Rocket.Chat's emoji data (470 KiB) and icon map (350 KiB). Loading features on demand is the only lever.
8. **A robustness gap the measurements exposed:** recent `@expo/metro-config` stores module source maps in a packed object form. In memory it is presented as a normal array, which is why real builds work. But if one ever reached the shaker in its stored form, re-minifying would throw and the whole bundle would ship unshaken. The shaker should accept that form directly.

## Options

| Option | Where | Expected saving | Effort |
|---|---|---|---|
| Fold `__DEV__` / `NODE_ENV` in production bundles | shaker | Expensify −1.3 points; 0 where already inlined | Small |
| Accept Expo's packed source maps | shaker | none (prevents losing all savings) | Small |
| Report translations, duplicates and dual builds in the build summary | shaker (diagnostics, roadmap Phase 5) | none directly; points apps at their biggest levers | Small |
| Load translations on demand | app | Rocket.Chat up to 15%, Expensify up to 24% of module code | App-specific |
| Deduplicate packages and dual builds | app config | Expensify ~1.1% | Small |
| Infer side-effect-free modules | shaker | ~0.1 point | Medium; not worth it now |
