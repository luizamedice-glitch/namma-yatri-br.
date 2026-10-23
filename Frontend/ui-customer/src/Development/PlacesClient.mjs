// SPDX-License-Identifier: AGPL-3.0-or-later
// Only the Brazilian Yatri API contract. No Google server key or fallback provider in the APK.
export function validateConfig(config) {
  if (!config || !config.backendUrl) throw new Error('Backend Yatri não configurado neste APK.');
  let url;
  try { url = new URL(config.backendUrl); } catch { throw new Error('URL do backend Yatri inválida.'); }
  const local = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
      /alce-mobilidade/i.test(url.pathname)) throw new Error('Use a URL exclusiva do backend Yatri; HTTPS ou rede local de testes.');
  const mapsTestMode = config.mapsTestMode === true;
  if (!mapsTestMode && !/^[a-f0-9]{64}$/.test(config.passengerCredential || '')) throw new Error('Credencial de desenvolvimento do passageiro não configurada.');
  return {base: url.href.replace(/\/$/, ''), credential: mapsTestMode ? '' : config.passengerCredential, mapsTestMode};
}
export const validPosition = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
  p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180 && (p.lat !== 0 || p.lng !== 0);
export function createPlacesClient(config, transport) {
  const {base, credential, mapsTestMode} = validateConfig(config);
  let token = '', sessionPromise;
  async function session() {
    if (token) return token;
    if (!sessionPromise) sessionPromise = transport(base + '/v1/development/session', {role: 'passenger', credential}, '')
      .then(response => {
        if (!/^[a-f0-9]{64}$/.test(response?.token || '') || response?.user?.role !== 'passenger' ||
            response?.user?.id !== 'b1a51100-0000-4000-8000-000000000001') throw new Error('Sessão do passageiro Yatri inválida.');
        token = response.token;
        return token;
      }).finally(() => {sessionPromise = null;});
    return sessionPromise;
  }
  async function post(path, payload, retry = true) {
    if (mapsTestMode) return transport(base + path.replace('/v1/', '/v1/test/'), payload, '');
    const bearer = await session();
    try { return await transport(base + path, payload, bearer); }
    catch (error) {
      if (error.status === 401 && retry) { if (token === bearer) token = ''; return post(path, payload, false); }
      throw error;
    }
  }
  return {
    async autocomplete(input, location) {
      const query = input.trim();
      if (query.length < 3) return [];
      if (query.length > 150) throw new Error('Digite um endereço com até 150 caracteres.');
      const result = await post('/v1/places/autocomplete', {input: query, ...(validPosition(location) ? {location} : {})});
      if (!Array.isArray(result?.suggestions)) throw new Error('Resposta de endereços inválida.');
      return result.suggestions.slice(0, 10).map(s => {
        if (!s || typeof s.placeId !== 'string' || !/^[\w:-]{3,255}$/.test(s.placeId) ||
            typeof s.address !== 'string' || !s.address.trim() || s.address.length > 1000) throw new Error('Sugestão de endereço inválida.');
        const comma = s.address.indexOf(',');
        return {placeId:s.placeId, address:s.address, title:comma < 0 ? s.address : s.address.slice(0,comma), subTitle:comma < 0 ? '' : s.address.slice(comma+1).trim()};
      });
    },
    async details(placeId) {
      if (typeof placeId !== 'string' || !/^[\w:-]{3,255}$/.test(placeId)) throw new Error('Selecione um endereço válido.');
      const p = await post('/v1/places/details', {placeId});
      if (!p || p.placeId !== placeId || typeof p.address !== 'string' || !p.address.trim() || p.address.length > 1000 || !validPosition(p.location)) throw new Error('Endereço sem coordenadas válidas.');
      return {placeId:p.placeId, address:p.address, lat:p.location.lat, lng:p.location.lng};
    }
  };
}
