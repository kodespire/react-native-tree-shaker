# @metro-tree-shaker/side-effects-db

Decides whether a module can be dropped when none of its exports are used.

- `resolveSideEffects(...)`: picks a package's `sideEffects` value. User overrides come first, then this package's curated database, then the package's own `package.json`. With no information, a package is assumed to have side effects.
- `hasSideEffects(field, relativePath)`: applies the field to one file with webpack's rules. Globs match paths relative to the package root, and a glob without `/` matches at any depth.

## The database

`data/side-effects.json` is **empty on purpose**. Many React Native libraries don't declare `sideEffects`, and some register native modules or components when a file loads. A wrong entry removes that code and crashes release builds.

Each entry needs a version range and a link to evidence (see [`schema.json`](schema.json) and [CONTRIBUTING](../../CONTRIBUTING.md)).
