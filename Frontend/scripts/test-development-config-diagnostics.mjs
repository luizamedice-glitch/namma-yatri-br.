// Exercise the real decoder FFI, preserving every original diagnostic and normal toast.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const original = await readFile(new URL('../ui-common/src/DecodeUtil/DecodeUtil.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../ui-customer/src/Development/ConfigDiagnostics.js', import.meta.url), 'utf8');
const diagnostic = 'Config Decode Failed - ErrorAtProperty visibility';
const consoleError = console.error;
let index = 0;
try {
  for (const [flag, name, os, cug, summarized, normalToasts] of [
    [true, 'in.juspay.nammayatri.debug', 'ANDROID', false, true, 1],
    [false, 'in.juspay.nammayatri.debug', 'ANDROID', false, false, 2],
    [undefined, 'in.juspay.nammayatri.debug', 'ANDROID', false, false, 2],
    ['true', 'in.juspay.nammayatri.debug', 'ANDROID', false, false, 2],
    [true, 'in.juspay.nammayatri', 'ANDROID', false, false, 0],
    [true, 'in.juspay.nammayatri.staging', 'ANDROID', false, false, 2],
    [true, 'in.juspay.nammayatri', 'ANDROID', true, false, 2],
    [true, 'in.juspay.nammayatri.debug', 'IOS', false, false, 0],
  ]) {
    const toasts = [], errors = [];
    globalThis.window = {__OS: os, __YATRI_BR_DEVELOPMENT__: flag,
      JBridge: {getDeviceInfo: () => JSON.stringify({package_name: name}), toast: s => toasts.push(s)},
      JOS: {getJOSflags: () => ({isCUGUser: cug})}};
    console.error = s => errors.push(s);
    const legacyUrl = 'data:text/javascript;base64,' + Buffer.from(original).toString('base64') + '#' + index++;
    const adapterSource = source.replaceAll('../../../ui-common/src/DecodeUtil/DecodeUtil.js', legacyUrl);
    const adapter = await import('data:text/javascript;base64,' + Buffer.from(adapterSource).toString('base64') + '#' + index++);
    const legacy = await import(legacyUrl);
    assert.deepEqual(Object.keys(adapter).sort(), Object.keys(legacy).sort(), 'foreign export surface changed');
    assert.equal(adapter.parseJSON, legacy.parseJSON, 'decoder binding changed');
    const {toastWithLog} = adapter;
    toastWithLog(diagnostic);
    toastWithLog(diagnostic);
    assert.deepEqual(errors, [diagnostic, diagnostic], 'all decoder diagnostics must remain logged');
    assert.equal(toasts.length, normalToasts, `${name}, ${flag}, ${os}`);
    if (summarized) {
      assert.match(toasts[0], /Detalhes no log/);
      assert.deepEqual(window.__YATRI_BR_CONFIG_DIAGNOSTICS__, {warnings: 2, notices: 1});
      assert.equal(Object.getOwnPropertyDescriptor(window, '__YATRI_BR_CONFIG_DIAGNOSTICS__').set, undefined);
    }
    else assert.ok(toasts.every(t => t === diagnostic), 'historical messages must remain unchanged');
    toastWithLog('Servidor indisponível');
    assert.equal(errors.at(-1), 'Servidor indisponível');
    if (os === 'ANDROID' && (name.includes('.debug') || name.includes('.staging') || cug)) {
      assert.equal(toasts.at(-1), 'Servidor indisponível', 'operational errors must remain visible');
    }
  }
} finally { console.error = consoleError; }
console.log('PASS: 8 actual adapter scenarios and unchanged foreign exports; BR-only config notice, complete logs, normal debug/release/staging/iOS behavior and operational messages preserved.');
