// SPDX-License-Identifier: AGPL-3.0-or-later
const path = require('path');
const webpack = require('webpack');
module.exports = function brPortuguesePlugin() {
  return new webpack.NormalModuleReplacementPlugin(/Resources\.LocalizableV2\.EN[\\/]index\.js$/, resource => {
    if (resource.request && resource.request.includes('?br-original-locale')) return;
    const adapter = path.resolve(__dirname, 'src/Localization/EnglishFallback.js');
    if (resource.resource) resource.resource = adapter;
    else resource.request = adapter;
  });
};
