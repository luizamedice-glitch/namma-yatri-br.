// SPDX-License-Identifier: AGPL-3.0-or-later
// Reuse the original Android HTTP bridge, as the original passenger already does.
// An opaque WebView origin must not require opening backend CORS to every origin.
export function createNativeFetch(bridge, mapCallback, removeCallback = () => {}) {
  return (url, options = {}) => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (options.signal) options.signal.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(Error('O servidor não respondeu. Verifique a conexão e tente novamente.'));
    if (options.signal && options.signal.aborted) return abort();
    if (options.signal) options.signal.addEventListener('abort', abort, {once:true});
    let callback;
    try {
      callback = mapCallback((_status, response, statusCode, _url, _headers, encoded) => {
        removeCallback(callback);
        if (settled) return;
        const status = Number(statusCode);
        if (!Number.isInteger(status) || status < 100) return finish(Error('Não foi possível conectar ao backend Yatri.'));
        finish(null, {status,ok:status >= 200 && status < 300,json:async () => {
          try {
            if (encoded) return JSON.parse(decodeURIComponent(encoded));
            try { return JSON.parse(response); }
            catch (_) { return JSON.parse(decodeURIComponent(escape(atob(response)))); }
          } catch (_) { throw Error('Resposta inválida do servidor operacional.'); }
        }});
      });
      bridge.callAPI(options.method || 'GET',url,options.body || '',JSON.stringify(options.headers || {}),false,false,callback);
    } catch (_) {
      if (callback) removeCallback(callback);
      finish(Error('Não foi possível conectar ao backend Yatri.'));
    }
  });
}
