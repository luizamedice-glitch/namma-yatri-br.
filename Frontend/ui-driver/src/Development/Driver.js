// SPDX-License-Identifier: AGPL-3.0-or-later
import {createOperationsClient} from '../../src/Development/OperationsClient.mjs';
import {createNativeFetch} from '../../src/Development/NativeTransport.mjs';
import {callbackMapper} from 'presto-ui';
let online, failure, timer, position, lastError;
export const enabled = () => {
  try { return window.__OS === 'ANDROID' && window.__YATRI_BR_DEVELOPMENT__ === true &&
    JSON.parse(window.JBridge.getDeviceInfo()).package_name === 'in.juspay.nammayatripartner.debug';
  } catch (_) { return false; }
};
export const checkpoint = phase => () => {
  if (enabled()) window.__YATRI_DRIVER_STARTUP__ = {phase};
};
// PrestoDOM's legacy Core2 copies the parent's registry during module loading.
// The driver entry initialized the Map flag earlier; resynchronize its type after
// imports, preserving the registry and every callback already registered by SDK.
export const prepareRuntime = () => {
  if (enabled()) window.__PROXY_FN_MAP_TYPE = window.__PROXY_FN instanceof Map;
};
export const startupError = message => () => {
  if (!enabled()) return;
  const detail = String(message).replace(/\b[a-fA-F0-9]{64}\b/g,'[REDACTED_SESSION]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED_KEY]');
  window.__YATRI_DRIVER_STARTUP__ = {phase:'failed',detail};
  console.error('Yatri driver startup:',detail);
};
function client() {
  if (!enabled()) throw Error('Operação restrita ao motorista BR debug.');
  return createOperationsClient({baseUrl:window.JBridge.getFromSharedPrefs('YATRI_DRIVER_BACKEND_URL'),
    token:window.JBridge.getFromSharedPrefs('YATRI_DRIVER_SESSION'),
    fetchImpl:createNativeFetch(window.JBridge,callbackMapper.map,id => {
      const registry=window.__PROXY_FN;
      if (registry instanceof Map) registry.delete(id); else if (registry) delete registry[id];
    })});
}
function failed(error) {
  const message = error.message || 'Não foi possível conectar ao servidor operacional.';
  window.__YATRI_DRIVER_OPERATIONS__ = {connected:false,error:message};
  if (failure && lastError !== message) failure(message)();
  lastError = message;
}
async function snapshot() {
  try {
    const data = await client().snapshot();
    if (online) online(data.available === true)();
    lastError = null;
    window.__YATRI_DRIVER_OPERATIONS__ = {connected:true, offers:data.offers.length, rides:data.rides.length};
  } catch (error) { failed(error); }
}
export const subscribe = ok => fail => gps => () => {
  online = ok; failure = fail;
  if (timer) clearInterval(timer);
  snapshot();
  let busy = false;
  timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { gps(); await snapshot(); } finally { busy = false; }
  }, 5000);
  return () => { clearInterval(timer); timer = null; online = failure = null; };
};
export const location = lat => lng => () => {
  if (!enabled()) return;
  position = {lat,lng};
  try { client().location(lat,lng).catch(failed); } catch (error) { failed(error); }
};
export const availability = available => ok => fail => () => {
  (async () => {
    try {
      const api = client();
      if (available) {
        if (!position) throw Error('Aguarde uma localização GPS válida antes de ficar disponível.');
        await api.location(position.lat,position.lng);
      }
      const data = await api.availability(available);
      ok(data.available)();
      if (online) online(data.available)();
      lastError = null;
    } catch(error) { failed(error); fail(error.message)(); }
  })();
};
