# Real apps with many dependencies

October 2026. `metro-tree-shaker` on two large open-source apps, compared with Expo's general shaker, to decide what to build next. How to reproduce: [benchmarks/real-apps](../benchmarks/real-apps). Raw data: [benchmarks/reports/real-apps](../benchmarks/reports/real-apps).

| App | React Native | Metro | Dependencies | JS bundle (iOS) |
|---|---|---|---:|---:|
| Rocket.Chat | 0.86.3 | 0.84.6 | 119 | 13.3 MiB |
| Expensify | 0.86.0 | 0.84.5 | 141 | 39.4 MiB (Metro path) |

## Headline

**Getter shaking works on both apps but saves almost nothing there: 0.2% and 0.1% of Hermes bytecode.** Each reads 54 of `react-native`'s 98 getters (two different sets that share 50), and `react-native` is only 3–4% of these bundles. On Rocket.Chat, Expo's general ESM shaker saves **7.0%**, 1.13 MiB against 40.5 KiB (about 28 times as many bytes), but only after four changes to the app's config.

## Results

Hermes bytecode, iOS production builds.

| App, setup | Without shaking | With shaking | Change |
|---|---:|---:|---:|
| Rocket.Chat, stock Metro, getter shaking | 16.40 MiB | 16.36 MiB | −0.2% (−40.5 KiB, 48 modules) |
| Rocket.Chat, Expo's Metro config without React Compiler, Expo's shaker | 16.08 MiB | 14.96 MiB | **−7.0%** (−1.13 MiB, 675 modules) |
| Expensify, Metro (`BUNDLER=metro`), getter shaking | 46.80 MiB | 46.75 MiB | −0.1% (−51.1 KiB, 39 modules) |

The two Rocket.Chat baselines differ because of those config changes: removing React Compiler alone moved the Expo-config baseline from 16.47 to 16.08 MiB.

Where Expo's shaker found the 1.13 MiB in Rocket.Chat: `@rocket.chat/ui-kit` −222 KiB (−96%), `ajv` −98 KiB (all of it), `rxjs` −82 KiB, `@expo/ui` −64 KiB, `react-native-gesture-handler` −54 KiB, `dayjs` −43 KiB. The app's own code shrank by only 0.3%.

## Findings

1. **Getter shaking needed two more patterns for real apps, and now handles both.**
   - `import RN, { UIManager } from 'react-native'` compiles to Babel's `interopRequireWildcard` helper (react-native-webrtc). The helper copies getters by descriptor without running them, so reads through it can be followed.
   - `react-native-worklets`' bundle mode redirects every `react-native` import in the app to a shim that does `module.exports = require('react-native')` (Expensify). Modules like that are now treated as aliases of `react-native`.
   - Each was the only blocker in its app. The shaker now prints every blocking file, not only the first.
2. **Safe on both apps, as far as static checks go.** For every getter treated as unread, [an audit](../benchmarks/real-apps/audit-unread-getters.mjs) looked for that name read from `react-native` inside the 822 (Rocket.Chat) and 2089 (Expensify) modules that import it; there were none. Sentry's serializer composed correctly: its debug-ID code is intact in Expensify's shaken bundle. **Neither app was run on a device**: Rocket.Chat generates its native projects with Expo prebuild and needs Firebase files that aren't in the repo, and Expensify's native build is heavier still.
3. **General ESM shaking is what matters for apps like these.** Measured on Rocket.Chat: 7.0%. It works on dependencies that ship ESM. How much is in reach, by bytes in the Metro bundle:

   | | Rocket.Chat | Expensify |
   |---|---:|---:|
   | Dependencies that ship ESM | 20.6% | 9.5% |
   | The app's own code (ESM, but mostly used: Expo removed 0.3%) | 33.8% | 68.4% |
   | Dependencies that are CommonJS only | 38.7% | 12.9% |
   | Unattributed (Metro's module wrappers) and unresolvable | 6.9% | 9.2% |

   These are ceilings; a shaker removes only the unused part.
4. **Expo's shaker isn't drop-in on a real app.** Rocket.Chat already uses `babel-preset-expo`, yet running it needed: Expo's Metro config, `cjs` added to source extensions, its Babel `overrides` flattened, and **React Compiler removed**, because with it Expo's tree shaking fails (`DataCloneError: Symbol() could not be cloned`). Expensify uses React Native's Babel preset, so Expo's shaker can't act on it at all without a bigger migration.
5. **Much of the weight is a load-on-demand problem, not a tree-shaking one.** No shaker removes code an app really imports:
   - Rocket.Chat: `mathjax-full` 1.7 MiB and `react-native-katex` 652 KiB (both CommonJS); 25 locale files totaling 1.8 MiB, all bundled up front (14% of the bundle); an icon-font map (349 KiB); `@expo/vector-icons` (452 KiB, mostly glyph maps).
   - Expensify: `xlsx` 480 KiB; `awesome-phonenumber` 510 KiB.
6. **Expensify's Metro path ships development-only code.** The bundle has React's development build, `react-devtools-core` (184 KiB) and a larger `react-reconciler` (302 KiB against 109 KiB in the Re.Pack build), because `NODE_ENV` isn't inlined when Expo's Metro config is used with React Native's Babel preset (the same pattern as the misconfigured bare app in [Phase 0](phase0-results.md)). This might differ in Expensify's own CI. It also means **the Re.Pack comparison isn't fair**: Expensify's Re.Pack build (50.5 MiB of bytecode) lacks the dev code but compiles imports with `lazyImports: true`, which turns them into CommonJS that Rspack can't shake. Treat neither number as a verdict on Re.Pack.

## Also changed

- **Metro 0.82–0.87** (React Native 0.79–0.88) are now supported. These apps use Metro 0.84. Every minor version runs the e2e tests (`npm run test:metro-versions`, also in CI).
- **`shake-report` attributes JSON modules.** Metro writes no source mappings for them, which had left 26% of Rocket.Chat as "unmapped". Reports saved for Phase 0 and Phase 1 predate this and show more unmapped bytes.

## Decision: what to build next

| Option | What it would do here | Effort |
|---|---|---|
| **General ESM shaking inside Metro** (roadmap Phase 3) | The only measured win on a large app: about 7% on Rocket.Chat, via Expo's shaker as a stand-in. Needs to work without Expo CLI, with React Compiler, and with ordinary Babel configs, which is where Expo's falls short. | Large |
| **Barrel-import rewriting** (Phase 2) | Part of the same gain for libraries imported through index files, in any bundler and in development. Its share of the 7% isn't measured. | Small |
| **Heavy-dependency report** (Phase 5) | Removes nothing, but flags what to fix: dev code in production (would have caught Expensify's), the largest CommonJS libraries, locales and icon maps loaded up front. | Small |

**Recommendation:** general ESM shaking (Phase 3), because it's the only option with a measured gain on the kind of app this project targets. The 7% comes from a bundle that was never run, built with a config Rocket.Chat doesn't ship, so treat it as an estimate. Do the heavy-dependency report's dev-code check alongside it, since it's cheap and found a real problem in one of two apps.
