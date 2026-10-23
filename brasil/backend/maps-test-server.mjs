// Explicit anonymous maps engine for the BR debug pilot. No users, sessions or DB.
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {mapsService} from './src/maps.mjs';
import {readBody} from './src/http.mjs';

export function createMapsTestServer({maps, enabled, until, production = false,
  now = Date.now, minuteLimit = 30, dailyLimit = 1000}) {
  const deadline = Date.parse(until);
  if (production || !enabled || !Number.isFinite(deadline) || deadline <= now() || deadline > now() + 7 * 86400000) {
    throw new Error('Motor de mapas exige modo de teste e janela de até sete dias, fora de produção');
  }
  let minute = -1, day = -1, minuteCount = 0, dayCount = 0;
  return http.createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store',
        'x-content-type-options':'nosniff', 'x-yatri-test-mode':'maps-only'});
      res.end(JSON.stringify(body));
    };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && path === '/health') {
        return reply(200, {status:'ok', service:'yatri-maps-test', active:now() < deadline});
      }
      const known = ['/v1/test/places/autocomplete','/v1/test/places/details','/v1/test/routes'];
      if (req.method !== 'POST' || !known.includes(path)) return reply(404, {error:'Rota não disponível neste motor de testes'});
      const time = now();
      if (time >= deadline) return reply(503, {error:'Janela de testes encerrada'});
      if (minute !== Math.floor(time / 60000)) {minute = Math.floor(time / 60000); minuteCount = 0;}
      if (day !== Math.floor(time / 86400000)) {day = Math.floor(time / 86400000); dayCount = 0;}
      if (minuteCount >= minuteLimit || dayCount >= dailyLimit) return reply(429, {error:'Limite compartilhado de testes atingido'});
      minuteCount++; dayCount++;
      const body = await readBody(req);
      let result;
      if (path.endsWith('/autocomplete')) result = await maps.autocomplete(body.input, body.location);
      else if (path.endsWith('/details')) result = await maps.details(body.placeId);
      else result = {routes:[await maps.route(body.origin, body.destination)]};
      reply(200, result);
    } catch (error) {
      reply(error.status || 500, {error:error.status ? error.message : 'Falha no motor de mapas de teste'});
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createMapsTestServer({
    maps:mapsService({key:process.env.GOOGLE_MAPS_SERVER_KEY}),
    enabled:process.env.YATRI_MAPS_TEST_MODE === 'true',
    until:process.env.YATRI_MAPS_TEST_UNTIL,
    production:process.env.NODE_ENV === 'production'
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 15000;
  server.listen(Number(process.env.PORT || 8081), process.env.HOST || '127.0.0.1');
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close());
}
