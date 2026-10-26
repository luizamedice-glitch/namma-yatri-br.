// SPDX-License-Identifier: AGPL-3.0-or-later
// Android-only FFI adapter: preserve the entire original decoder/export surface and normal behavior.
export * from '../../../ui-common/src/DecodeUtil/DecodeUtil.js';
import {toastWithLog as originalToastWithLog} from '../../../ui-common/src/DecodeUtil/DecodeUtil.js';

const enabled = window.__OS === 'ANDROID' && window.__YATRI_BR_DEVELOPMENT__ === true &&
  JSON.parse(window.JBridge.getDeviceInfo()).package_name.endsWith('.debug');
let warnings = 0;
let noticeShown = false;
if (enabled) {
  Object.defineProperty(window, '__YATRI_BR_CONFIG_DIAGNOSTICS__', {
    get: () => ({warnings, notices: noticeShown ? 1 : 0}), configurable: false,
  });
}
export const toastWithLog = function (message) {
  if (!enabled || typeof message !== 'string' || !message.startsWith('Config Decode Failed')) {
    return originalToastWithLog(message);
  }
  warnings += 1;
  console.error(message);
  if (!noticeShown) {
    noticeShown = true;
    window.JBridge.toast('Configuração legada incompleta. Detalhes no log.');
  }
};
