// SPDX-License-Identifier: AGPL-3.0-or-later
import {callbackMapper} from 'presto-ui';
import {createPlacesClient} from '../../src/Development/PlacesClient.mjs';

let listener, revision = 0, input = '', source = false, client;
let snapshot = {configured:false, phase:'idle', source:null, destination:null};
function enabled() {
  try { return window.__OS === 'ANDROID' && window.__YATRI_BR_DEVELOPMENT__ === true &&
    JSON.parse(window.JBridge.getDeviceInfo()).package_name.endsWith('.debug'); }
  catch (_) { return false; }
}
function transport(url, payload, token) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value);};
    const timer = setTimeout(() => finish(new Error('O servidor não respondeu. Verifique a conexão e tente novamente.')), 15000);
    try {
      const callback = callbackMapper.map((status, response, statusCode, _url, _headers, encoded) => {
        try {
          let body;
          if (encoded) { try {body = JSON.parse(decodeURIComponent(encoded));} catch (_) {} }
          if (body === undefined) { try {body = JSON.parse(response);} catch (_) {body = JSON.parse(decodeURIComponent(escape(window.atob(response))));} }
          const code = Number(statusCode);
          if (!Number.isInteger(code) || code < 200 || code >= 300) {
            const message = code === 401 ? 'Sessão de desenvolvimento recusada pelo backend Yatri.' :
              code === 503 ? 'Pesquisa indisponível: configure o serviço Places no backend Yatri.' :
              code === 429 ? 'Muitas buscas. Aguarde um momento e tente novamente.' : 'Não foi possível pesquisar endereços. Verifique a conexão e tente novamente.';
            const error = new Error(message); error.status = code; finish(error);
          } else finish(null, body);
        } catch (_) {finish(new Error('Resposta inválida do servidor de endereços.'));}
      });
      window.JBridge.callAPI('POST', url, JSON.stringify(payload), JSON.stringify({'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {})}), false, false, callback);
    } catch (_) {finish(new Error('Não foi possível conectar ao backend Yatri.'));}
  });
}
function getClient() {
  if (!enabled()) throw new Error('Pesquisa brasileira disponível somente no APK de desenvolvimento.');
  if (!client) {
    let config;
    try {config = JSON.parse(window.JBridge.loadFileInDUI('yatri_places_config.json'));}
    catch (_) {throw new Error('Backend Yatri não configurado neste APK.');}
    client = createPlacesClient(config, transport);
    snapshot.configured = true;
  }
  return client;
}
function fail(error, version) {
  if (revision !== version || !listener) return;
  snapshot.phase = 'error'; listener.error(error.message)();
}
export const subscribe = predictions => selected => error => () => {
  if (!enabled()) return () => {};
  const subscription = {predictions,selected,error}; listener = subscription;
  if (!Object.getOwnPropertyDescriptor(window,'__YATRI_BR_PLACES_STATE__')) {
    Object.defineProperty(window,'__YATRI_BR_PLACES_STATE__',{get:() => JSON.parse(JSON.stringify(snapshot))});
  }
  return () => {if (listener === subscription) {listener = null; revision++;}};
};
export const inputChanged = value => isSource => () => {revision++; input = value; source = isSource; snapshot.phase = 'typing';};
export const cancel = () => {revision++; input = ''; snapshot.phase = 'idle';};
export const autocomplete = value => isSource => lat => lng => () => {
  if (value !== input || isSource !== source || !listener) return;
  const version = ++revision;
  if (value.trim().length < 3) {snapshot.phase = 'idle'; listener.predictions(isSource)([])(); return;}
  snapshot.phase = 'searching';
  Promise.resolve().then(() => getClient().autocomplete(value, {lat,lng})).then(items => {
    if (revision !== version || !listener) return;
    snapshot.phase = items.length ? 'results' : 'empty'; listener.predictions(isSource)(items)();
  }).catch(error => fail(error, version));
};
export const details = placeId => isSource => () => {
  const version = ++revision; snapshot.phase = 'loading-place';
  Promise.resolve().then(() => getClient().details(placeId)).then(place => {
    if (revision !== version || !listener) return;
    snapshot.phase = 'selected'; snapshot[isSource ? 'source' : 'destination'] = place;
    listener.selected(isSource)(place)();
  }).catch(error => fail(error, version));
};
