// Metro config that writes which react-native getters the app reads, then
// stops the build. Wraps the app's metro.config.js from the current directory.
//
//   OUT=getters.json npx react-native bundle --config <this file> --entry-file index.js --platform ios --dev false
const fs = require('node:fs');
const path = require('node:path');
const { planGetterShaking } = require('../../packages/metro-tree-shaker');
const { analyzeEntry } = require('../../packages/metro-tree-shaker/dist/reactNative/analyze.js');

const exported = require(path.join(process.cwd(), 'metro.config.js'));

module.exports = async (defaults) => {
  const base = await (typeof exported === 'function' ? exported(defaults) : exported);
  return {
    ...base,
    serializer: {
      ...base.serializer,
      customSerializer: async (entryPoint, preModules, graph, options) => {
        const plan = planGetterShaking(graph.dependencies, [...graph.entryPoints, ...options.runBeforeMainModule]);
        const entry = graph.dependencies.get(plan.entry);
        const getters = [...analyzeEntry(entry.output[0].data.code, entry.dependencies.size).getters.keys()];
        fs.writeFileSync(
          process.env.OUT,
          JSON.stringify({ kept: plan.keptGetters, unread: getters.filter((g) => !plan.keptGetters.includes(g)), skipped: plan.skipped }, null, 2) + '\n',
        );
        process.exit(0);
      },
    },
  };
};
