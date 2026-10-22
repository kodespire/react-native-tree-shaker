# Fixtures

Each directory is one ESM/CommonJS interop case that the shaker must handle correctly. [`fixtures.test.ts`](fixtures.test.ts) checks that every case is well formed. Every case is also bundled with real Metro plus `metro-tree-shaker`, checked against `expected.json`, and run:

- Phase 1 cases in [`reactNative.e2e.test.ts`](../packages/metro-tree-shaker/test/reactNative.e2e.test.ts);
- Phase 3 cases in [`shaking.e2e.test.ts`](../packages/metro-tree-shaker/test/shaking.e2e.test.ts), four ways: Metro's import support and Babel's CommonJS output (`@react-native/babel-preset`), each with and without `inlineRequires`. Each build is compared with plain Metro's: same output when run, and the exports and modules `expected.json` lists.

`node_modules/` directories inside cases are **checked in**. They model real package resolution, and `.gitignore` re-includes them.

## `expected.json`

```json
{
  "description": "What the case tests.",
  "phase": 3,
  "entry": "index.js",
  "modules": { "kept": ["index.js", "math.js"], "removed": [] },
  "exports": { "math.js": { "kept": ["used"], "removed": ["unused"] } },
  "output": ["2"],
  "overrides": { "babel+inlineRequires": { "output": ["4"] } },
  "notes": "Optional: why, and other acceptable outcomes."
}
```

- `phase`: the roadmap phase expected to make the case pass (1 or 3).
- `modules`: every `.js` file in the case, including under `node_modules/`, must be listed exactly once.
- `exports`: per kept module, exports that must survive and exports that must go. Names not listed may go either way. CommonJS modules that assign `exports.x` are shaken like ESM; ones that replace `module.exports` keep everything.
- `output` (optional): the lines the bundle must print when it runs. Shaken bundles must always print what plain Metro's print.
- `overrides` (optional): a different `modules`, `exports` or `output` for one build variant: `metro` or `babel`, plus `+inlineRequires`. With `inlineRequires`, Metro itself drops imports whose bindings are unused, so only modules plain Metro ships are checked.

## Cases

| Case | Tests |
|---|---|
| `unused-named-export` | Unused named export removed |
| `side-effect-free-package` | Package with `sideEffects: false` dropped when unused |
| `undeclared-package-kept` | Package without `sideEffects` kept; its unused export still removed |
| `side-effect-import` | Bare `import './polyfill'` kept |
| `export-star-barrel` | `export *` over ESM expanded and shaken; unused star target removed |
| `export-star-shadowed` | A barrel's own export shadows the same name from `export *` |
| `export-star-over-cjs` | `export *` over `module.exports = {...}` keeps that module whole |
| `namespace-static-member` | `ns.a` keeps only `a` |
| `namespace-dynamic-access` | `ns[key]` keeps everything |
| `cjs-requires-esm` | `require()` of ESM read through static members keeps only those |
| `cjs-reads-own-exports` | CommonJS reading its own `exports` keeps everything |
| `module-exports-object` | `module.exports = {...}` keeps its exports; its own reads are still tracked |
| `cjs-entry-picks-build` | An entry that picks `require('./prod')` or `require('./dev')` at runtime, like React's, is an alias of both |
| `export-used-locally` | An export the module also uses itself keeps its value when the export goes |
| `interop-default-and-namespace` | Default and namespace imports of CommonJS and ESM |
| `reexport-chain` | Usage traced through re-export hops |
| `default-reexport` | `export { default as X } from` shaken |
| `reexport-from-side-effect-module` | Unread re-exports go; their source stays only if it has side effects |
| `export-let-live-binding` | Mutable `export let`; writes to an unread export go, the code making them stays |
| `circular-imports` | Modules importing each other; exports freed by an earlier round go in a later one |
| `react-native-getters` | Unused getters on react-native's CommonJS entry removed (Phase 1) |
| `react-native-namespace-import` | `import * as RN from 'react-native'` keeps every getter (Phase 1) |
| `react-native-reexport-shim` | Reads through a module that re-exports react-native still count (Phase 1) |
