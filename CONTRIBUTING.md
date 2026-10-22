# Contributing

## Setup

```bash
npm install
```

```bash
npm run build
```

```bash
npm test
```

`npm run typecheck` also type-checks the tests.

## Layout

- `packages/*`: published packages, written in TypeScript and compiled to CommonJS so `metro.config.js` and Babel can `require()` them.
- `benchmarks/`: the Phase 0 size harness (private).
- `fixtures/`: ESM/CommonJS interop cases with expected shaking results.
- `docs/`: architecture, roadmap, prior art.

## Adding a fixture

1. Create `fixtures/<case-name>/` with an entry file and the modules it imports. Packages go in `fixtures/<case-name>/node_modules/`, which is checked in.
2. Add `expected.json` (see [`fixtures/README.md`](fixtures/README.md)). Every `.js` file in the case must be listed as kept or removed.
3. Run `npm test`. The fixture validator checks that it is well formed, and the e2e tests bundle it with real Metro, four ways for general-shaking cases, compare it with plain Metro and run it. A fixture for a bug should fail before the fix.
4. Run `npm run test:metro-versions` to check every supported Metro minor.

## Adding a side-effects override

Entries in `packages/side-effects-db/data/side-effects.json` must link to evidence: the package source showing the module is side-effect free, or a maintainer statement. An unverified entry can remove code that registers native modules and crash release builds, so don't add one without evidence.
