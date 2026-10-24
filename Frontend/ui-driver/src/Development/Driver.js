// SPDX-License-Identifier: AGPL-3.0-or-later
import {createOperationsClient} from './OperationsClient.mjs';
let online, failure, timer, position, lastError;
export const enabled = () => {
  try { return window.__OS === 'ANDROID' && window.__YATRI_BR_DEVELOPMENT__ === true &&
    JSON.parse(window.JBridge.getDeviceInfo()).package_name === 'in.juspay.nammayatripartner.debug';
  } catch (_) { return false; }
};
function client() {
  if (!enabled()) throw Error('Operação restrita ao motorista BR debug.');
  return createOperationsClient({baseUrl:window.JBridge.getFromSharedPrefs('YATRI_DRIVER_BACKEND_URL'),
    token:window.JBridge.getFromSharedPrefs('YATRI_DRIVER_SESSION')});
}
function failed(error) {
  const message = error.message || 'Não foi possível conectar ao servidor operacional.';
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
