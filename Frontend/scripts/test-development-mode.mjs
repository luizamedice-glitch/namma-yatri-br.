// Exercise the actual FFI gate. These are device descriptors, never API responses or sessions.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../ui-common/src/Engineering/Helpers/DevelopmentMode.js', import.meta.url), 'utf8');
const {isEnabled} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
globalThis.window = {};
assert.equal(isEnabled(), false);
for (const [flag, name, expected] of [
  [true, 'in.juspay.nammayatri.debug', true],
  [false, 'in.juspay.nammayatri.debug', false],
  ['true', 'in.juspay.nammayatri.debug', false],
  [true, 'in.juspay.nammayatri', false],
  [true, 'in.juspay.nammayatri.staging', false],
]) {
  window.__YATRI_BR_DEVELOPMENT__ = flag;
  window.JBridge = {getDeviceInfo: () => JSON.stringify({package_name: name})};
  assert.equal(isEnabled(), expected, `${name}, ${flag}`);
}
window.JBridge.getDeviceInfo = () => {throw new Error('bridge unavailable');};
assert.equal(isEnabled(), false);
window.JBridge.getDeviceInfo = () => 'invalid-json';
assert.equal(isEnabled(), false);
console.log('PASS: gate BR habilita apenas flag explicita + pacote debug; falhas fecham o gate.');
