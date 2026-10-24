/*eslint-env node */
const {
  merge
} = require('webpack-merge');
const common = require('./webpack.config.js');
const webpack = require('webpack');
const brConfigDiagnosticsPlugin = require('./webpack.br-config-diagnostics.cjs');
const brPortuguesePlugin = require('./webpack.br-portuguese.cjs');
const packageJSON = require("./package.json");
var path = require('path');

const getOutputFileDir = (mode) => mode == "development" ? "" : "android/";
const outputFileName = "index_bundle.js";
const getOutputFileLocation = (mode) => getOutputFileDir(mode) + outputFileName;

module.exports = (env, argv) => {
  let plugins = [
    brConfigDiagnosticsPlugin(),
    brPortuguesePlugin(),
    new webpack.DefinePlugin({
      __VERSION__: JSON.stringify(packageJSON.version),
      "window.configEnv": JSON.stringify(env)
    })
  ]
  const base = common(env);
  base.module.rules[0].use.options.plugins = [require.resolve('./webpack.br-portuguese-babel.cjs')];
  return merge(base, {
    output: {
      filename: getOutputFileLocation(argv.mode),
      sourceMapFilename: getOutputFileLocation(argv.mode) + ".map"
    },
    plugins: plugins,
    devServer: {
      contentBase: path.join(__dirname, 'dist'),
      host: "0.0.0.0",
      inline: false,
      port: 8084
    }
  });
}
