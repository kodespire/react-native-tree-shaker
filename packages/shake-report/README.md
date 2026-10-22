# @react-native-tree-shaker/shake-report

Measures a React Native bundle, and compares two measurements.

- Raw, gzip and brotli size
- Hermes bytecode size (from a `.hbc` file, or by compiling with `hermesc`)
- Module count (`__d(` definitions)
- Bytes per npm package, from the source map. Index (sectioned) maps from Metro 0.86+ are supported. Every byte is attributed, so the package totals add up to the bundle size. Metro writes no mappings for JSON modules but lists them in `sources` in bundle order, so those module lines are attributed by position. Remaining bytes with no mapping (Metro's module wrappers, the prelude) show as `(unmapped)`, and an inlined `sourceMappingURL=data:` comment shows as `(inline source map)`.
- Development-only code, from the source map: React's `*.development.js` builds and React DevTools. In a production bundle these usually mean `process.env.NODE_ENV` wasn't inlined, so the text report warns about them (JSON: `developmentCode`).

## CLI

Measure a bundle:

```bash
npx shake-report stats index.android.bundle --map index.android.bundle.map --hermesc <path-to-hermesc> --label baseline --json baseline.json
```

Compare two measurements:

```bash
npx shake-report diff baseline.json shaken.json
```

Both print Markdown tables, ready to paste into a PR.

## API

```ts
import { analyzeBundle, diffReports, formatDiff, findHermesc, compileHermes, findDevelopmentCode } from '@react-native-tree-shaker/shake-report';
```

`findHermesc(appRoot)` looks in the same places React Native's build scripts use: the CocoaPods `hermes-engine`, the `hermes-compiler` package, then `react-native/sdks/hermesc`.
