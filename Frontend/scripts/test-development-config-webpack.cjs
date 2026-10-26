// Verify the actual Android module replacement against real compiler output, not a mocked bundle.
const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const app = path.resolve(__dirname, '../ui-customer');
const webpack = require(require.resolve('webpack', {paths: [app]}));
const plugin = require(path.join(app, 'webpack.br-config-diagnostics.cjs'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yatri-ffi-bundle-'));
webpack({mode: 'none', target: 'node', context: app,
  entry: {ffi: path.join(app, 'output/DecodeUtil/foreign.js'), module: path.join(app, 'output/DecodeUtil/index.js')},
  output: {path: temp, filename: '[name].cjs', libraryTarget: 'commonjs2'}, plugins: [plugin()]}, (error, stats) => {
  const originalError = console.error;
  try {
    if (error) throw error;
    if (stats.hasErrors()) throw new Error(stats.toString({all: false, errors: true}));
    for (const name of ['ffi', 'module']) {
      const toasts = [], diagnostics = [];
      global.window = {__OS: 'ANDROID', __YATRI_BR_DEVELOPMENT__: true,
        JBridge: {getDeviceInfo: () => JSON.stringify({package_name: 'in.juspay.nammayatri.debug'}), toast: s => toasts.push(s)},
        JOS: {getJOSflags: () => ({isCUGUser: false})}};
      console.error = s => diagnostics.push(s);
      const actual = require(path.join(temp, name + '.cjs'));
      for (let i = 0; i < 10; i++) actual.toastWithLog('Config Decode Failed - field');
      assert.equal(toasts.length, 1, name);
      assert.equal(diagnostics.length, 10, name);
      assert.deepEqual(window.__YATRI_BR_CONFIG_DIAGNOSTICS__, {warnings: 10, notices: 1});
      assert.equal(typeof actual.parseJSON, 'function');
      actual.toastWithLog('Servidor indisponível');
      assert.equal(toasts.at(-1), 'Servidor indisponível');
    }
    console.log('PASS: actual Webpack replacement through direct foreign entry and compiled PureScript module; logs retained and operational toasts unchanged.');
  } catch (failure) {
    process.exitCode = 1;
    originalError(failure);
  } finally {
    console.error = originalError;
    fs.rmSync(temp, {recursive: true, force: true});
  }
});
