// Wraps an app's Metro config so a production build also writes its module
// graph to $GRAPH_OUT. Used by react-native-getters.mjs.
//
//   APP_ROOT=<app> GRAPH_OUT=<file.json> npx react-native bundle --config <this file> ...
const fs = require('node:fs');
const path = require('node:path');

const appRoot = process.env.APP_ROOT;
const graphOut = process.env.GRAPH_OUT;
if (!appRoot || !graphOut) throw new Error('Set APP_ROOT and GRAPH_OUT');

const { loadMetroDefaultSerializer } = require('../../packages/react-native-tree-shaker/dist/serializer.js');

module.exports = async (defaultConfig) => {
  const exported = require(path.join(appRoot, 'metro.config.js'));
  const base = await (typeof exported === 'function' ? exported(defaultConfig) : exported);
  const next = base.serializer?.customSerializer ?? loadMetroDefaultSerializer(appRoot);

  return {
    ...base,
    serializer: {
      ...base.serializer,
      customSerializer: async (entryPoint, preModules, graph, options) => {
        const modules = [...graph.dependencies.values()].map((module) => ({
          path: module.path,
          bytes: Buffer.byteLength(module.output.find((o) => o.type.startsWith('js/'))?.data.code ?? ''),
          dependencies: [...module.dependencies.values()].map((d) => ({ name: d.data.name, path: d.absolutePath })),
        }));
        fs.writeFileSync(
          graphOut,
          JSON.stringify({ entryPoints: [...graph.entryPoints], runBeforeMainModule: options.runBeforeMainModule, modules }),
        );
        return next(entryPoint, preModules, graph, options);
      },
    },
  };
};
