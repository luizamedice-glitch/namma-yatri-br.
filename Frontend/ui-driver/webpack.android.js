/*eslint-env node */
const {merge} = require('webpack-merge');
const common = require('./webpack.config.js');
const webpack = require('webpack');
const packageJSON = require("./package.json");
var path = require('path');

const getOutputFileDir = (mode) => mode ==  "development" ? "" :"android/";
const outputFileName = "index_bundle.js";
const getOutputFileLocation = (mode) => getOutputFileDir(mode) + outputFileName;


module.exports = (env, argv) => {
  let plugins = [
      new webpack.DefinePlugin({
        "window.__OS": JSON.stringify("ANDROID"),
        __VERSION__: JSON.stringify(packageJSON.version),
        "window.configEnv": JSON.stringify(env)
      })]
  if (process.env.YATRI_DRIVER_TEST_BUILD === 'true') {
    plugins.push(new webpack.NormalModuleReplacementPlugin(/JBridge[\\/]foreign\.js$/, resource => {
      if (resource.request && resource.request.includes('?br-driver-original-bridge')) return;
      const adapter = path.resolve(__dirname, 'src/Development/LocalJBridge.js');
      if (resource.resource) resource.resource = adapter;
      else resource.request = adapter;
    }));
    plugins.push(new webpack.NormalModuleReplacementPlugin(/^\.\/output\/Main$/, path.resolve(__dirname, 'output/Development.Driver/index.js')));
    plugins.push(new webpack.NormalModuleReplacementPlugin(/Common\.RemoteConfig\.Utils[\\/]foreign\.js$/, resource => {
      if (resource.request && resource.request.includes('?br-driver-original-config')) return;
      const adapter = path.resolve(__dirname, 'src/Development/LocalRemoteConfig.js');
      if (resource.resource) resource.resource = adapter;
      else resource.request = adapter;
    }));
    plugins.push(new webpack.NormalModuleReplacementPlugin(/Resource\.Localizable\.EN[\\/]index\.js$/, resource => {
      if (resource.request && resource.request.includes('?br-driver-original-locale')) return;
      const adapter = path.resolve(__dirname, 'src/Development/EnglishFallback.js');
      if (resource.resource) resource.resource = adapter;
      else resource.request = adapter;
    }));
  }
  return merge(common(env), {
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
