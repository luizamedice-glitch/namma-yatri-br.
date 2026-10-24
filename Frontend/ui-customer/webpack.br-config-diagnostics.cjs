// SPDX-License-Identifier: AGPL-3.0-or-later
// Keep PureScript's original foreign interface/cache intact; adapt presentation at Android bundling.
const path = require('path');
const webpack = require('webpack');
module.exports = function brConfigDiagnosticsPlugin() {
  const original = path.resolve(__dirname, 'output/DecodeUtil/foreign.js');
  const adapter = path.resolve(__dirname, 'src/Development/ConfigDiagnostics.js');
  return new webpack.NormalModuleReplacementPlugin(/foreign\.js$/, resource => {
    if (resource.resource === original) resource.resource = adapter;
    else if (resource.request && path.resolve(resource.context || __dirname, resource.request) === original) {
      resource.request = adapter;
    }
  });
};
