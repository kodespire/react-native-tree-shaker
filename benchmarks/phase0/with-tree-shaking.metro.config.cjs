// Metro config for benchmark variants: the app's own config (from the
// current directory, or Expo's default when the app has none) wrapped with
// withTreeShaking from this repo. METRO_TREE_SHAKER_EXPORTS=0 turns off
// general shaking, leaving only react-native getter shaking.
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const { withTreeShaking } = require('../../packages/metro-tree-shaker');

const appRoot = process.cwd();
const appConfig = path.join(appRoot, 'metro.config.js');

module.exports = withTreeShaking(
  fs.existsSync(appConfig)
    ? require(appConfig)
    : createRequire(path.join(appRoot, 'package.json'))('expo/metro-config').getDefaultConfig(appRoot),
  { shakeExports: process.env.METRO_TREE_SHAKER_EXPORTS !== '0' },
);
