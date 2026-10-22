# Architecture

## Why Metro does not shake today

```
source (ESM + TS/Flow/JSX)
  └─ transform worker: one file at a time, cached per file
       Babel preset: strip types, JSX, codegen
       ESM → CommonJS   (@babel/plugin-transform-modules-commonjs, or Metro's
                         import-export plugin when experimentalImportSupport is on)
       minify
  └─ serializer: sees the whole graph, but every module is already
       __d(function (global, require, …, module, exports) { exports.foo = …; exports.bar = … })
```

Shaking needs whole-graph knowledge ("does anything import `bar`?"). Metro only has that in the serializer, after every module is already CommonJS. `metro-tree-shaker` works there anyway: it reads the imports and exports back out of the transformed code.

## React Native getter shaking (Phase 1, shipped)

This removes whole modules and rewrites none. It runs in the serializer on Metro's normal, already-transformed output ([`src/reactNative`](../packages/metro-tree-shaker/src/reactNative)).

1. **Read the getters.** Parse `react-native/index.js`'s output: `__d(function(g,r,i,a,m,e,d){m.exports={get View(){return r(d[13]).default},...}})`. Each `d[N]` inside a getter body is a dependency only that getter needs; any `d[N]` outside a getter is always needed.
2. **Find reads.** For every module whose dependency map points at the entry, follow each `require(d[N])` (or `importDefault`) through variables, destructuring, inline member access, Babel's lazy-import helper and its `interopRequireDefault`/`interopRequireWildcard` helpers, with Babel scope tracking, because minifiers reuse short names across scopes. A module that sets `module.exports` to the entry (a re-exporting shim) becomes an alias, and its importers' reads count. The factory's parameters are identified by position, because minifiers rename them. `importAll` and anything that lets the object escape (spread, computed key, passing it to a function) count as reading every getter.
3. **Fixed point.** Reachability from the entry points and `runBeforeMainModule`, following only read getters' edges out of the entry. Code that becomes reachable is scanned for more reads, until nothing changes. As a safety check, following every getter must reach the whole graph.
4. **Serialize.** Pass the next serializer the same graph object (a `Proxy`) with the removed modules filtered out of `dependencies`, and build the bundle source map from that graph with Metro's own `sourceMapStringNonBlocking`. An e2e test checks the map matches Metro's byte for byte on an unshaken graph.

`react-native/index.js` keeps its getters for removed modules; their module IDs simply aren't defined. A missed read therefore fails loudly ("Requiring unknown module") at the line that reads it, not silently.

## General shaking (Phase 3, shipped)

General shaking also runs in the serializer on Metro's normal transform output ([`src/analysis`](../packages/metro-tree-shaker/src/analysis), [`src/shaking`](../packages/metro-tree-shaker/src/shaking)). It installs no transformer. So it works with whatever Babel config the app has (React Compiler, Reanimated's plugin), keeps Metro's per-file transform cache, and behaves the same under the React Native CLI, Rock and Expo CLI. The price is that it has to understand transformed code, and it has to re-minify the modules it changes.

### 1. Read each module

Each module is a minified `__d(function(g,r,i,a,m,e,d){...})` factory. The parameters are found by position, because minifiers rename them, and Babel's scope tracking resolves every name. ESM reaches the serializer in one of two shapes:

| | Babel (`@react-native/babel-preset`, the React Native default) | Metro's import support (`experimentalImportSupport`) |
|---|---|---|
| Export | `e.X=…`, after `e.a=e.b=void 0` placeholders | `e.X=…` |
| Re-export | `Object.defineProperty(e,"X",{get(){return r(d[0]).X}})` | `e.X=r(d[0]).X` |
| Import | `r(d[0])`, through `interopRequireDefault` / `interopRequireWildcard` (from `@babel/runtime`, or inlined: as functions, or as the expression `(n = r(d[0])) && n.__esModule ? n : {default: n}` the minifier makes of babel-preset-expo's) and its lazy-import helper | `r(d[0])`, `i(d[0])` (default), `a(d[0])` (namespace) |
| `export *` | `Object.keys(r(d[0])).forEach(function(n){… Object.defineProperty(e,n,…)})`, skipping names the module exports itself (`n in e`, or `hasOwnProperty.call(e,n)` in babel-preset-expo's version) | `for(var n in r(d[0])) "default"!==n&&(e[n]=r(d[0])[n])` |

From that, each module gets:

- **Exports.** The names it defines, if every use of `e` is a write to a literal name, a `defineProperty` with a literal name, or inside a recognized `export *` loop. Otherwise its exports are *pinned* (it reads its own exports, passes `e` somewhere, replaces `module.exports`, or uses a computed key) and none are removed. CommonJS modules that write `exports.x = …` get the same treatment as ESM, including libraries published as Babel-compiled CommonJS.
- **Reads.** For each dependency, the export names the module reads, found by following the require through variables, destructuring, member access, the interop helpers and functions that return it. Anything the analysis can't follow (a computed key, the object passed to a function, a spread) reads every export of that dependency, with the reason recorded.
- **`export *` loops and aliases.** Which dependencies it re-exports wholesale, and whether it is `module.exports = require(x)`. A module can be an alias of several: React's entry picks `require('./cjs/react.production.js')` or the development build at runtime, and both branches ship when `NODE_ENV` isn't inlined.

Interop depends on whether the target marks itself `__esModule`: `importDefault` and the interop helpers return an ES module as is, but wrap a CommonJS one; `importAll` of a CommonJS module copies (reads) every property. When the target is unknown, the analysis assumes both.

An ES module's export read whose value is thrown away (`var x = r(d[0]).x` with `x` unused) doesn't count as a read. A CommonJS getter read does, because getters can run code (react-native's getters require modules).

### 2. Usage across the graph

The roots (entry points and `runBeforeMainModule`), async imports' targets and modules that couldn't be parsed have every export used. Every other module's used names are the union of its importers' reads. Aliases and `export *` pass their own usage on to their targets, to a fixed point. A barrel's own export shadows the same name from `export *`, and `default` never passes through `export *`.

### 3. Rewrite

For each module, in rounds:

- remove assignments and `defineProperty` calls for exports nothing reads, keeping whatever side effects the value had (a call stays; a require stays if the module it loads may have side effects), and keeping the value itself where the module uses it (Babel compiles `export const x = …` that the module also reads to `var x = exports.x = …`);
- remove `export *` loops whose target can't supply any name read through them;
- remove requires of side-effect-free modules whose value is unused, following it through variables, member reads and interop helpers (the minifier turns `var _a = _interopRequireDefault(require('./a'))` into `var c = r(d[0]), a = i(c)`, so `c` looks used until `a` is known to be unused).

"Side-effect free" comes from the package's `sideEffects` field (webpack's semantics, globs included), the curated [`side-effects-db`](../packages/side-effects-db), and the `sideEffects` option. A file outside any named package, or in a package that declares nothing, may have side effects.

Changed modules are printed with Babel and re-minified with the app's own minifier (`transformer.minifierPath` and `minifierConfig`; when the build isn't minified, the same minifier without mangling, printed readably). The minifier removes code that only the removed exports used. With terser (Metro's default) it runs at least two compress passes: the first often only inlines an IIFE into variable assignments, and the second drops the variables. That's how typia-generated validators, `export const isX = (() => { … })()`, disappear once nothing reads them. An IIFE that only declares things and returns counts as free of side effects. Their source maps are composed onto the module's original map and stored in Metro's own format (VLQ from Metro 0.86, tuples before). Removing code can leave more exports unread, so rounds repeat until one changes nothing (at most 10). Modules nothing requires anymore are then dropped.

### 4. Self-check and serialize

Before anything ships: no kept module may still require a removed one, and every name a kept module reads that was defined before must still be defined. If either fails, or anything throws, the bundle is built unshaken and the log says why. This check trusts the analysis, so it can't catch the analysis's own mistakes; [`benchmarks/real-apps`](../benchmarks/real-apps) has two independent checks (dangling requires, and initializing every module of a plain and a shaken bundle side by side). Serialization then works as in Phase 1: a `Proxy` graph for the next serializer, and a source map built from it.

General shaking steps aside when Expo's own tree shaking is on (Expo's optimized graph hands over untransformed modules), and with `unstable_inlineDependencyMap` or `dependencyMapReservedName`.

## Serializer composition

Metro allows one `customSerializer`. `withTreeShaking` wraps whatever is already configured (for example an observability SDK's serializer) and falls back to Metro's own `baseJSBundle` + `bundleToString`, loaded from the app's copy of Metro. If a custom serializer returns only a string, Metro builds the source map itself from the **unshaken** graph (`Server.js`, `getBundle`), so once modules change the wrapper returns `{ code, map }` built from the shaken graph. In development builds it is a strict pass-through.

## More React Native-specific work (Phase 4)

- **Internal export objects.** `Animated`'s export object includes `AnimatedFlatList`, so `ScrollView` pulls in `FlatList` and the virtualized lists. Object-shaped exports like this are invisible to both getter shaking and ESM shaking.
- **Side effects.** Most RN libraries do not declare `sideEffects`, and native module/component registration (`TurboModuleRegistry`, `codegenNativeComponent`, `AppRegistry`) runs at module load. Unknown packages are treated as having side effects. A curated, evidence-backed override list lives in `side-effects-db`.
- **CommonJS in `node_modules`.** CommonJS that replaces `module.exports` with an object can't have exports removed. The resolver could prefer ESM or source entry points where packages ship them.

## What stays the same

- Development builds, Fast Refresh and HMR.
- Per-platform bundles (Metro already bundles iOS and Android separately).
- Hermes compiles the final bundle as before.
