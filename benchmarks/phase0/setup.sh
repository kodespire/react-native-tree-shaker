#!/usr/bin/env bash
# Creates the Phase 0 benchmark apps and writes benchmarks/bench.config.json.
#
# Usage: benchmarks/phase0/setup.sh <apps-dir> [results-dir]
#
# Apps go outside the repo: each one is several hundred MB of node_modules.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <apps-dir> [results-dir]" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$1"
APPS_DIR="$(cd "$1" && pwd)"
RESULTS_DIR="${2:-$REPO_DIR/benchmarks/results}"

RN_VERSION=0.88.0
RN_CLI_VERSION=20.2.0
CREATE_EXPO_VERSION=5.0.0
EXPO_SDK=sdk-58
EXPO_VERSION=58.0.16

export CI=1 EXPO_NO_TELEMETRY=1

cd "$APPS_DIR"

# 1. Bare React Native CLI template: stock Metro.
if [ ! -d rn-template ]; then
  npx --yes "@react-native-community/cli@$RN_CLI_VERSION" init BenchTemplate \
    --directory rn-template --version "$RN_VERSION" --pm npm --skip-git-init --install-pods false
fi

# 2. Expo default template (expo-router, tabs): a typical new app.
if [ ! -d expo-default ]; then
  npx --yes "create-expo-app@$CREATE_EXPO_VERSION" expo-default --template "default@$EXPO_SDK" --no-agents-md
fi

# 3. Expo blank template plus libraries imported through barrel files: the best case for shaking.
if [ ! -d expo-barrels ]; then
  npx --yes "create-expo-app@$CREATE_EXPO_VERSION" expo-barrels --template "blank-typescript@$EXPO_SDK" --no-agents-md
  (
    cd expo-barrels
    npm install --save-exact date-fns@4.4.0 lodash-es@4.18.1 lucide-react-native@1.60.0
    npx expo install react-native-svg
  )
  cp "$REPO_DIR/benchmarks/phase0/expo-barrels.App.tsx" expo-barrels/App.tsx
fi

# 4. The bare template bundled with Expo's toolchain (the `expo` package and
#    expo/metro-config) without other changes: the cheapest way for a bare app
#    to try Expo's shaker. bare-expo keeps @react-native/babel-preset;
#    bare-expo-preset also switches to babel-preset-expo.
for app in bare-expo bare-expo-preset; do
  if [ ! -d "$app" ]; then
    cp -Rc rn-template "$app" 2>/dev/null || cp -R rn-template "$app"
    (cd "$app" && npm install --save-exact "expo@$EXPO_VERSION")
  fi
done

# Expo CLI only reads metro.config.js from the project root (export:embed's
# --config doesn't apply to Metro), so Expo apps get one that adds
# metro-tree-shaker when METRO_TREE_SHAKER=1 (METRO_TREE_SHAKER_EXPORTS=0 leaves
# out general shaking). Without it, this is Expo's default.
for app in expo-default expo-barrels bare-expo bare-expo-preset; do
  cat > "$app/metro.config.js" <<EOF
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = process.env.METRO_TREE_SHAKER
  ? require('$REPO_DIR/packages/metro-tree-shaker').withTreeShaking(config, {
      shakeExports: process.env.METRO_TREE_SHAKER_EXPORTS !== '0',
    })
  : config;
EOF
done
if ! grep -q babel-preset-expo bare-expo-preset/babel.config.js; then
  (
    cd bare-expo-preset
    # npm nests babel-preset-expo under expo/, so Babel can't find it without a direct dependency.
    npm install --save-dev "babel-preset-expo@$(node -p "require('expo/package.json').dependencies['babel-preset-expo']")"
  )
  cat > bare-expo-preset/babel.config.js <<'EOF'
module.exports = {
  presets: ['babel-preset-expo'],
};
EOF
fi

# Record exactly what was measured.
{
  echo "node $(node --version)"
  for app in rn-template expo-default expo-barrels bare-expo bare-expo-preset; do
    echo "## $app"
    (cd "$app" && node -e '
      const fs = require("fs");
      const deps = ["react-native", "react", "expo", "metro", "@expo/metro-config", "hermes-compiler", "date-fns", "lodash-es", "lucide-react-native", "react-native-svg"];
      const dirs = ["node_modules", "node_modules/react-native/node_modules"];
      for (const d of deps) {
        const file = dirs.map((dir) => `${dir}/${d}/package.json`).find((f) => fs.existsSync(f));
        if (file) console.log(d, JSON.parse(fs.readFileSync(file, "utf8")).version);
      }')
  done
} > "$APPS_DIR/versions.txt"

node "$REPO_DIR/benchmarks/phase0/write-config.mjs" "$APPS_DIR" "$RESULTS_DIR" > "$REPO_DIR/benchmarks/bench.config.json"
echo "Apps ready in $APPS_DIR. Wrote benchmarks/bench.config.json."
