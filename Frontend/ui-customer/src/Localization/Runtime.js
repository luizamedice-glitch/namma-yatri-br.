// SPDX-License-Identifier: AGPL-3.0-or-later
import catalog from './pt-BR.json';

let checkedWindow, portuguese = false;
export function isPortugueseEnabled() {
  if (typeof window === 'undefined') return false;
  if (checkedWindow === window) return portuguese;
  checkedWindow = window;
  try {
    portuguese = window.__OS === 'ANDROID' && window.__YATRI_BR_PT_BR__ === true &&
      window.__YATRI_BR_DEVELOPMENT__ === true &&
      JSON.parse(window.JBridge.getDeviceInfo()).package_name === 'in.juspay.nammayatri.debug';
  } catch (_) { portuguese = false; }
  return portuguese;
}

if (isPortugueseEnabled()) {
  window.__YATRI_BR_LOCALIZATION__ = {locale: 'pt-BR', messages: Object.keys(catalog.messages).length};
}

export function localizeLiteral(value) {
  return isPortugueseEnabled() && Object.prototype.hasOwnProperty.call(catalog.literals, value)
    ? catalog.literals[value] : value;
}

function curryTemplate(template, arity, args = []) {
  return value => {
    const next = [...args, value];
    return next.length === arity
      ? template.replace(/\{(\d+)\}/g, (_, index) => String(next[Number(index)]))
      : curryTemplate(template, arity, next);
  };
}

export function createPortugueseRecord(original) {
  if (!isPortugueseEnabled()) return original;
  const translated = {...original};
  for (const key of Object.keys(original)) {
    const message = catalog.messages[key];
    if (message) translated[key] = message.arity
      ? curryTemplate(message.text, message.arity) : message.text;
  }
  return translated;
}
