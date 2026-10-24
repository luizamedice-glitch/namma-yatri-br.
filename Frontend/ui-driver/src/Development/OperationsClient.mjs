// SPDX-License-Identifier: AGPL-3.0-or-later
export function createOperationsClient({baseUrl, token, fetchImpl = fetch}) {
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
      if (!response.ok) throw Error(response.status === 401 ? 'Sessão de teste expirada ou inválida.' : 'Servidor operacional recusou a operação (' + response.status + ').');
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  return {snapshot:async () => {
      const data = await call('/snapshot');
      if (data.user?.role !== 'driver') throw Error('Esta sessão não pertence ao motorista.');
      return data;
    },
    location:(lat,lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) throw Error('Localização GPS inválida.');
      return call('/driver/location',{lat,lng});
    },
    availability:available => call('/driver/availability',{available}),
    rideAction:(id,action) => {
      if (!/^[0-9a-f-]{36}$/.test(id) || !['accept','reject','arrive','start','complete','cancel'].includes(action)) throw Error('Ação de corrida inválida.');
      return call('/rides/' + id + '/' + action,{});
    }};
}
