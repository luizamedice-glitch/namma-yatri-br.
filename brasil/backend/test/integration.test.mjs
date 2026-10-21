// Real HTTP + real PostgreSQL. Google transport alone is an explicit test fixture.
// This suite proves backend behavior, not Google billing/key readiness or Android UI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connectDatabase } from '../src/db.mjs';
import { migrate } from '../src/migrate.mjs';
import { mobilityService } from '../src/mobility.mjs';
import { createApi } from '../src/http.mjs';
test('HTTP + PostgreSQL: oferta, concorrência, SSE, autorização, persistência e ciclo completo', { timeout: 45000 }, async t => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL obrigatória; não há fallback em memória');
  const pool = await connectDatabase(process.env.DATABASE_URL);
  const schema = 'integration_' + randomUUID().replaceAll('-', '');
  await pool.query(`CREATE SCHEMA ${schema}`);
  const { default: pg } = await import('pg');
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 10 });
  const maps = { route: async () => ({ distanceMeters: 1200, durationSeconds: 240, encodedPolyline: 'fixture-only', fareCents: 740 }) };
  const config = { inviteCode: 'test-invite-code-123456' };
  const service = mobilityService(db, maps, config);
  const server = createApi({ service, maps, pool: db, rateLimit: 1000 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => {
    server.closeStreams(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await db.end(); await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end();
  });
  await migrate(db); await migrate(db);
  async function call(path, token, body, expected = 200) {
    const response = await fetch(base + '/v1' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = await response.json();
    assert.equal(response.status, expected, JSON.stringify(value)); return value;
  }
  const account = async (name, role, plate) => call('/auth/register', null, { name, role, email: name + '@teste.local', password: 'senha-integration-123', inviteCode: config.inviteCode, ...(plate ? { vehicle: { plate, model: 'Veículo de teste', color: 'Prata' } } : {}) });
  await call('/auth/register', null, { inviteCode: 'errado' }, 403);
  const p = await account('passageiro', 'passenger');
  const p2 = await account('terceiro', 'passenger');
  const d1 = await account('motorista1', 'driver', 'ABC1D23');
  const d2 = await account('motorista2', 'driver', 'DEF4G56');
  await call('/auth/login', null, { email: 'passageiro@teste.local', password: 'incorreta' }, 401);
  const logged = await call('/auth/login', null, { email: 'passageiro@teste.local', password: 'senha-integration-123' });
  assert.equal(logged.user.id, p.user.id);
  await call('/snapshot', null, undefined, 401);
  await call('/driver/availability', p.token, { available: true }, 403);
  await call('/driver/availability', d1.token, { available: true }, 409);
  for (const d of [d1, d2]) {
    await call('/driver/location', d.token, { lat: -23.55, lng: -46.63 });
    await call('/driver/availability', d.token, { available: true });
  }
  const quote = await call('/quotes', p.token, { origin: { lat: -23.55, lng: -46.63, address: 'Origem teste' }, destination: { lat: -23.56, lng: -46.64, address: 'Destino teste' } });
  const { id } = await call('/rides', p.token, { quoteId: quote.id, fareCents: 1 });
  assert.equal((await call('/rides', p.token, { quoteId: quote.id })).id, id, 'reenvio não cria outra corrida');
  assert.equal((await call('/snapshot', d1.token)).offers[0].id, id);
  await call('/rides/' + id, p2.token, undefined, 404);
  // Disconnect/reconnect via a new service instance reads the same persistent offers.
  const restarted = mobilityService(db, maps, config);
  assert.equal((await restarted.snapshot(d1.user)).offers[0].id, id);
  const controller = new AbortController();
  const events = await fetch(base + '/v1/events', { headers: { Authorization: 'Bearer ' + p.token }, signal: controller.signal });
  assert.equal(events.status, 200);
  const reader = events.body.getReader(); let received = '';
  const receivedEvent = (async () => {
    while (!received.includes('ride.updated')) { const next = await reader.read(); if (next.done) break; received += new TextDecoder().decode(next.value); }
    assert.match(received, /ride.updated/);
  })();
  const accepts = await Promise.all([d1, d2].map(d => fetch(base + '/v1/rides/' + id + '/accept', { method: 'POST', headers: { Authorization: 'Bearer ' + d.token, 'Content-Type': 'application/json' }, body: '{}' })));
  assert.deepEqual(accepts.map(r => r.status).sort(), [200, 409]);
  const winner = accepts[0].status === 200 ? d1 : d2;
  const loser = winner === d1 ? d2 : d1;
  await receivedEvent; controller.abort();
  const r = await call('/rides/' + id, p.token);
  assert.equal(r.driver_id, winner.user.id); assert.equal(r.fare_cents, 740);
  await call('/rides/' + id + '/start', p.token, {}, 403);
  await call('/rides/' + id + '/start', winner.token, {}, 409);
  await call('/rides/' + id + '/arrive', loser.token, {}, 403);
  for (const action of ['arrive', 'start', 'complete']) await call('/rides/' + id + '/' + action, winner.token, {});
  assert.equal((await call('/rides/' + id, p.token)).status, 'completed');
  assert.equal((await call('/rides/' + id, p.token)).driver_lat, null, 'histórico não expõe GPS atual do motorista');
  assert.equal((await call('/rides', winner.token)).rides[0].status, 'completed');
  assert.equal((await call('/snapshot', p.token)).rides.length, 0);
  await call('/rides/' + id + '/cancel', p.token, {}, 409);
  // New request, decline, out-of-radius and stale GPS protection.
  const q2 = await call('/quotes', p.token, { origin: quote.origin, destination: quote.destination });
  const second = await call('/rides', p.token, { quoteId: q2.id });
  await call('/rides/' + second.id + '/reject', loser.token, {});
  assert.equal((await call('/snapshot', loser.token)).offers.length, 0);
  await call('/rides/' + second.id + '/accept', loser.token, {}, 409);
  await call('/driver/location', winner.token, { lat: 0, lng: 0 });
  await call('/rides/' + second.id + '/accept', winner.token, {}, 409);
  await db.query(`UPDATE drivers SET location_at=now()-interval '2 minutes' WHERE user_id=$1`, [winner.user.id]);
  await call('/rides/' + second.id + '/accept', winner.token, {}, 409);
  await call('/rides/' + second.id + '/cancel', p.token, {});
  assert.equal((await call('/rides/' + second.id, p.token)).status, 'cancelled');
  // A single driver cannot accept two different rides concurrently either.
  await call('/driver/availability', d2.token, { available: false });
  await call('/driver/location', d1.token, { lat: -23.55, lng: -46.63 });
  await call('/driver/availability', d1.token, { available: true });
  const q3 = await call('/quotes', p.token, { origin: quote.origin, destination: quote.destination });
  const q4 = await call('/quotes', p2.token, { origin: quote.origin, destination: quote.destination });
  const r3 = await call('/rides', p.token, { quoteId: q3.id });
  const r4 = await call('/rides', p2.token, { quoteId: q4.id });
  const driverRace = await Promise.all([r3,r4].map(r => fetch(base + '/v1/rides/' + r.id + '/accept', { method: 'POST', headers: { Authorization: 'Bearer ' + d1.token, 'Content-Type': 'application/json' }, body: '{}' })));
  assert.deepEqual(driverRace.map(r=>r.status).sort(), [200,409]);
  const busy = await db.query(`SELECT count(*)::integer AS total FROM rides WHERE driver_id=$1 AND status IN ('accepted','arrived','in_progress')`, [d1.user.id]);
  assert.equal(busy.rows[0].total, 1);
  const q5 = await call('/quotes', p.token, { origin: quote.origin, destination: quote.destination });
  await call('/rides', p.token, { quoteId: q5.id }, 409);
  await call('/rides/' + r3.id + '/cancel', p.token, {});
  await call('/rides/' + r4.id + '/cancel', p2.token, {});
  // Expiration is enforced from database time, not client flags.
  await db.query(`UPDATE quotes SET expires_at=now()-interval '1 second' WHERE id=$1`, [q5.id]);
  await call('/rides', p.token, { quoteId: q5.id }, 409);
  const q6 = await call('/quotes', p.token, { origin: quote.origin, destination: quote.destination });
  const r6 = await call('/rides', p.token, { quoteId: q6.id });
  await db.query(`UPDATE rides SET created_at=now()-interval '11 minutes' WHERE id=$1`, [r6.id]);
  await restarted.dispatch();
  assert.equal((await call('/rides/' + r6.id, p.token)).status, 'cancelled');
  const unrelated = await restarted.events(p2.user, '0');
  assert.equal(unrelated.some(e => e.payload.rideId === id), false, 'eventos de outros passageiros permanecem privados');
  const storage = await db.query('SELECT token_hash FROM sessions WHERE user_id=$1', [p.user.id]);
  assert.equal(storage.rows.some(row=>row.token_hash === p.token), false);
  await call('/auth/logout', p.token, {});
  await call('/snapshot', p.token, undefined, 401);
});
