// Real PostgreSQL + HTTP, with an explicitly marked Google route fixture only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { connectDatabase } from '../src/db.mjs';
import { migrate } from '../src/migrate.mjs';
import { developmentAccounts } from '../src/development.mjs';
import { mobilityService } from '../src/mobility.mjs';
import { createApi } from '../src/http.mjs';

test('Fagner/Giselo: provisionamento persistente, isolamento e ciclo completo por HTTP', { timeout: 30000 }, async t => {
  const admin = await connectDatabase(process.env.DATABASE_URL);
  const schema = 'dev_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await migrate(pool);
  const config = { enabled: true, passengerKey: randomBytes(32).toString('hex'), driverKey: randomBytes(32).toString('hex'),
    vehicle: { plate: 'TST1A23', model: 'Veículo cadastrado de testes', color: 'Prata' } };
  const development = await developmentAccounts(pool, config);
  const maps = { route: async () => ({ distanceMeters: 1200, durationSeconds: 240, encodedPolyline: 'fixture-only', fareCents: 740 }) };
  const service = mobilityService(pool, maps);
  const server = createApi({ pool, maps, service, development });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeStreams(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/v1';
  async function call(path, token, body, status = 200) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value;
  }
  await call('/development/session', null, { role: 'driver', credential: config.passengerKey }, 401);
  await call('/development/session', null, { role: 'passenger', credential: config.driverKey }, 401);
  for (const role of ['admin', '__proto__', 'constructor']) await call('/development/session', null, { role, credential: config.driverKey }, 401);
  await call('/auth/register', null, {}, 403);
  await call('/auth/login', null, {}, 403);
  const passenger = await call('/development/session', null, { role: 'passenger', credential: config.passengerKey });
  const driver = await call('/development/session', null, { role: 'driver', credential: config.driverKey });
  assert.equal(passenger.user.name, 'Fagner'); assert.equal(driver.user.name, 'Giselo');
  assert.notEqual(passenger.user.id, driver.user.id);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 2);
  // Restart provisioning without duplicating accounts or expiring existing sessions.
  const restarted = await developmentAccounts(pool, config);
  const newSession = await restarted.session({ role: 'passenger', credential: config.passengerKey });
  assert.equal(newSession.user.id, passenger.user.id);
  assert.notEqual(newSession.token, passenger.token);
  assert.equal((await service.authenticate(passenger.token)).id, passenger.user.id);
  const stored = await pool.query('SELECT token_hash FROM sessions');
  assert.ok(stored.rows.every(x => x.token_hash !== passenger.token && x.token_hash !== driver.token));
  await call('/driver/location', passenger.token, { lat: -23.55, lng: -46.63 }, 403);
  await call('/quotes', driver.token, {}, 403);
  await call('/driver/location', driver.token, { lat: -23.55, lng: -46.63 });
  await call('/driver/availability', driver.token, { available: true });
  const quote = await call('/quotes', passenger.token, { origin: { lat: -23.55, lng: -46.63, address: 'Origem do teste automatizado' }, destination: { lat: -23.56, lng: -46.64, address: 'Destino do teste automatizado' } });
  const ride = await call('/rides', passenger.token, { quoteId: quote.id });
  assert.equal((await call('/snapshot', driver.token)).offers[0].passenger_name, 'Fagner');
  for (const [action, status] of [['accept', 'accepted'], ['arrive', 'arrived'], ['start', 'in_progress'], ['complete', 'completed']]) {
    await call('/rides/' + ride.id + '/' + action, driver.token, {});
    for (const user of [passenger, driver]) {
      const value = await call('/rides/' + ride.id, user.token);
      assert.equal(value.status, status); assert.equal(value.driver_name, 'Giselo'); assert.equal(value.passenger_name, 'Fagner');
    }
  }
  await call('/rides/' + ride.id + '/start', passenger.token, {}, 403);
  const disabled = await developmentAccounts(pool);
  assert.equal(disabled, null);
  await assert.rejects(developmentAccounts(pool, { ...config, driverKey: config.passengerKey }), /diferentes/);
  await assert.rejects(developmentAccounts(pool, { ...config, driverKey: '' }), /32 bytes/);
  await assert.rejects(developmentAccounts(pool, { ...config, vehicle: {} }), /veículo/);
});
