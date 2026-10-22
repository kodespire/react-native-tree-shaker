# Prior art

| Project | Approach | Status (October 2026) | Gap this project targets |
|---|---|---|---|
| [Expo](https://docs.expo.dev/guides/tree-shaking) (`@expo/metro-config`) | Transform worker caches the ESM syntax tree. A serializer plugin computes used exports, then a "reconcile" pass lowers to CommonJS and minifies. | Experimental: `EXPO_UNSTABLE_TREE_SHAKING=1`, production only | Shaking runs only when the `usedExports` serializer option is set, which Expo CLI does. Plain `react-native bundle` doesn't set it (from reading [`treeShakeSerializerPlugin.ts`](https://github.com/expo/expo/blob/main/packages/@expo/metro-config/src/serializer/treeShakeSerializerPlugin.ts)). A bare app also needs `babel-preset-expo` for it to remove anything. Leaves `react-native` itself almost untouched (−3%). On Rocket.Chat it needed four config changes and fails with React Compiler (`DataCloneError`); without the compiler it saved 7.0%. Measured in [phase0-results.md](phase0-results.md) and [real-apps-results.md](real-apps-results.md). |
| [rnx-kit `metro-serializer-esbuild`](https://github.com/microsoft/rnx-kit/tree/main/packages/metro-serializer-esbuild) | Replaces Metro's serializer with esbuild | Beta | Shakes `export *` poorly; esbuild doesn't fully lower to what Hermes supports; production only |
| [Re.Pack](https://re-pack.dev) | Replaces Metro with Rspack, which supports tree shaking | Stable bundler | Requires leaving Metro |

Expo's implementation is MIT-licensed. Where it makes sense, port pieces with attribution instead of reinventing them.

## Related techniques

- Per-library Babel plugins such as `babel-plugin-lodash` rewrite imports for one library.
- Some libraries, such as [Lucide](https://lucide.dev/guide/react-native/advanced/optimizations), document importing each icon from its own module because Metro won't drop unused barrel exports.
- Metro already removes `__DEV__` branches and inlines `Platform.OS` within a single file. That is per-file constant folding, not tree shaking.
