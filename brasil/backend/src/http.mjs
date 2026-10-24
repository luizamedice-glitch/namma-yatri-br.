import http from 'node:http';
import { ApiError, requireThat } from './domain.mjs';

export async function readBody(req) {
  let bytes = 0; const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 20000) throw new ApiError(413, 'Requisição excede 20 KB');
    chunks.push(chunk);
  }
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
  catch { throw new ApiError(400, 'JSON inválido'); }
  requireThat(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 400, 'Corpo JSON precisa ser um objeto');
  return parsed;
}

export function createApi({ service, maps, pool, allowedOrigin = '', rateLimit = 120, development = null, allowedRoutes = null }) {
  const buckets = new Map();
  const connections = new Set();
  function reply(res, status, data) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify(data));
  }
  const server = http.createServer(async (req, res) => {
    if (allowedOrigin && req.headers.origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin); res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Last-Event-ID');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health' && req.method === 'GET') {
        await pool.query('SELECT 1'); return reply(res, 200, { status: 'ok', service: 'namma-yatri-br' });
      }
      const now = Date.now();
      for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
      // Do not trust forwarded IPs. Pilot is intended for a private network only.
      const ip = req.socket.remoteAddress;
      if (!buckets.has(ip)) buckets.set(ip, { count: 0, until: now + 60000 });
      requireThat(++buckets.get(ip).count <= rateLimit, 429, 'Muitas requisições; tente novamente em um minuto');
      if (allowedRoutes) requireThat(allowedRoutes.includes(req.method + ' ' + url.pathname), 404, 'Rota não encontrada');
      if (req.method === 'POST' && ['/v1/auth/register', '/v1/auth/login', '/v1/development/session'].includes(url.pathname)) {
        // Separate low limit for expensive password hashing.
        const key = 'auth:' + ip;
        if (!buckets.has(key)) buckets.set(key, { count: 0, until: now + 60000 });
        requireThat(++buckets.get(key).count <= 15, 429, 'Limite de autenticação atingido');
        const body = await readBody(req);
        if (url.pathname === '/v1/development/session') {
          requireThat(development, 404, 'Rota não encontrada');
          return reply(res, 200, await development.session(body));
        }
        requireThat(!development, 403, 'Login e cadastro desativados neste ambiente de desenvolvimento');
        return reply(res, 200, await (url.pathname.endsWith('register') ? service.register(body) : service.login(body)));
      }
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      const user = await service.authenticate(token);
      if (req.method === 'GET' && url.pathname === '/v1/events') {
        requireThat(connections.size < 200, 503, 'Limite de conexões atingido');
        let cursor = String(req.headers['last-event-id'] || url.searchParams.get('after') || '0');
        requireThat(/^\d{1,18}$/.test(cursor), 400, 'Cursor inválido');
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        connections.add(res);
        res.write('event: connected\ndata: {}\n\n');
        let busy = false;
        const timer = setInterval(async () => {
          if (busy) return; busy = true;
          try {
            if (Date.now() >= new Date(user.expires_at).getTime()) { res.end(); return; }
            await service.authenticate(token);
            const events = await service.events(user, cursor);
            for (const event of events) {
              cursor = String(event.id);
              if (!res.write(`id: ${cursor}\nevent: ${event.kind}\ndata: ${JSON.stringify(event.payload)}\n\n`)) { res.end(); return; }
            }
            if (!events.length) res.write(': heartbeat\n\n');
          } catch { res.end(); }
          finally { busy = false; }
        }, 1000);
        res.on('close', () => { clearInterval(timer); connections.delete(res); });
        return;
      }
      let result;
      if (req.method === 'GET') {
        if (url.pathname === '/v1/snapshot') result = await service.snapshot(user);
        else if (url.pathname === '/v1/rides') result = { rides: await service.history(user) };
        else if (/^\/v1\/rides\/[^/]+$/.test(url.pathname)) result = await service.ride(user, url.pathname.split('/')[3]);
      } else if (req.method === 'POST') {
        const body = await readBody(req);
        if (url.pathname === '/v1/auth/logout') result = await service.logout(token);
        else if (url.pathname === '/v1/driver/availability') result = await service.availability(user, body);
        else if (url.pathname === '/v1/driver/location') result = await service.location(user, body);
        else if (url.pathname === '/v1/places/autocomplete') result = await maps.autocomplete(body.input, body.location);
        else if (url.pathname === '/v1/places/details') result = await maps.details(body.placeId);
        else if (url.pathname === '/v1/routes') result = { routes: [await maps.route(body.origin, body.destination)] };
        else if (url.pathname === '/v1/quotes') result = await service.quote(user, body);
        else if (url.pathname === '/v1/rides') result = await service.requestRide(user, body);
        else {
          const match = url.pathname.match(/^\/v1\/rides\/([^/]+)\/(accept|reject|arrive|start|complete|cancel)$/);
          if (match) {
            const [, id, action] = match;
            result = action === 'accept' ? await service.accept(user, id) : action === 'reject' ? await service.reject(user, id) : await service.change(user, id, action);
          }
        }
      }
      requireThat(result !== undefined, 404, 'Rota não encontrada');
      reply(res, 200, result);
    } catch (e) {
      if (res.headersSent) { res.end(); return; }
      const conflict = e.code === '23505';
      const status = e.status || (conflict ? 409 : 500);
      if (status >= 500) console.error('Falha API:', e.name, e.code || 'INTERNAL');
      reply(res, status, { error: e.status ? e.message : conflict ? 'Cadastro duplicado ou corrida ativa já existente' : 'Erro interno do serviço' });
    }
  });
  server.requestTimeout = 20000; server.headersTimeout = 15000;
  server.closeStreams = () => { for (const res of connections) res.end(); };
  return server;
}
