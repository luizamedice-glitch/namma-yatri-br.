// SPDX-License-Identifier: AGPL-3.0-or-later
export function createOperationsClient({baseUrl, token, fetchImpl = fetch,role='driver'}) {
  if (!/^https?:\/\/[^\s]+$/.test(baseUrl || '') || !/^[a-f0-9]{64}$/.test(token || ''))
    throw Error('Configure o servidor operacional e a sessão do dispositivo de teste.');
  const base = baseUrl.replace(/\/$/, '');
  async function call(path, body) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetchImpl(base + '/v1' + path, {method: body === undefined ? 'GET' : 'POST',
        headers: {'content-type':'application/json', Authorization:'Bearer ' + token},
        ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:abort.signal});
      if (!response.ok) {
        let detail;try{detail=await response.json();}catch(_){}
        throw Error(response.status === 401 ? 'Sessão de teste expirada ou inválida.' : detail && typeof detail.error==='string' ? detail.error.slice(0,180) : 'Servidor operacional recusou a operação (' + response.status + ').');
      }
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  return {snapshot:async () => {
      const data = await call('/snapshot');
      if ((!data.user || data.user.role !== role)) throw Error(role==='driver'?'Esta sessão não pertence ao motorista.':'Esta sessão não pertence ao passageiro.');
      return data;
    },
    navigation:id=>call('/rides/'+id+'/navigation'),
    ride:id=>call('/rides/'+id),
    quote:(origin,destination)=>call('/quotes',{origin,destination}),
    requestRide:quoteId=>call('/rides',{quoteId}),
    location:(lat,lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180 || (lat === 0 && lng === 0)) throw Error('Localização GPS inválida.');
      return call('/driver/location',{lat,lng});
    },
    availability:available => call('/driver/availability',{available}),
    rideAction:(id,action) => {
      if (!/^[0-9a-f-]{36}$/.test(id) || !['accept','reject','arrive','start','complete','cancel'].includes(action)) throw Error('Ação de corrida inválida.');
      return call('/rides/' + id + '/' + action,{});
    }};
}
