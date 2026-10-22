# @react-native-tree-shaker/babel-plugin-optimize-barrels

> **Stub.** The plugin loads but doesn't rewrite anything yet. This is Phase 2 of the [roadmap](../../docs/roadmap.md).

Rewrites imports from barrel files (`index.js` files that only re-export) to the modules that define them, so the bundler never pulls in the rest of the library:

```js
// before
import { Button } from 'big-lib';
// after
import Button from 'big-lib/lib/Button';
```

This works with any bundler and in development, because it only changes import paths.

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [['@react-native-tree-shaker/optimize-barrels', { packages: ['big-lib'] }]],
};
```

The planned behavior is listed as `it.todo` cases in [`test/index.test.ts`](test/index.test.ts).
