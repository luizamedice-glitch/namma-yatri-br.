// Real PostgreSQL + HTTP, with an explicitly marked Google route fixture only.
import { test } from 'node:test';
import { createRequire } from 'node:module';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { connectDatabase } from '../../brasil/backend/src/db.mjs';
import { migrate } from '../../brasil/backend/src/migrate.mjs';
import { developmentAccounts } from '../../brasil/backend/src/development.mjs';
import { mobilityService } from '../../brasil/backend/src/mobility.mjs';
import { createApi } from '../../brasil/backend/src/http.mjs';
import { createDriverPilot } from '../../brasil/backend/src/driver-pilot.mjs';
import { provisionDriverPilot } from '../../brasil/backend/src/provision-driver-pilot.mjs';
import {issuePairing,pairingHash} from '../../brasil/backend/src/driver-pairing.mjs';
import { createOperationsClient } from '../ui-driver/src/Development/OperationsClient.mjs';

test('Fagner/Giselo: provisionamento persistente, isolamento e ciclo completo por HTTP', { timeout: 30000 }, async t => {
  const admin = await connectDatabase(process.env.DATABASE_URL);
  const schema = 'dev_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pg = createRequire(new URL('../../brasil/backend/package.json', import.meta.url))('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await migrate(pool);
  const config = { enabled: true, passengerKey: randomBytes(32).toString('hex'), driverKey: randomBytes(32).toString('hex'),
    vehicle: { plate: 'TST1A23', model: 'Veículo cadastrado de testes', color: 'Prata' } };
  const development = await developmentAccounts(pool, config);
  await provisionDriverPilot(pool,config.vehicle);
  await assert.rejects(provisionDriverPilot(pool,{...config.vehicle,plate:'TST9Z99'}),/EXISTING_VEHICLE_DIFFERS/);
  let mapsCalls=0;
  const maps = { route: async () => (mapsCalls++,{ distanceMeters: 1200, durationSeconds: 240, encodedPolyline: 'fixture-only', fareCents: 740 }) };
  const service = mobilityService(pool, maps, { allowDevelopmentAccounts: true });
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
  const privateDir = await mkdtemp(join(tmpdir(), 'driver-session-test-'));
  t.after(() => rm(privateDir,{recursive:true,force:true}));
  const sessionFile = join(privateDir,'session.json');
  const scoped = new URL(process.env.DATABASE_URL);
  scoped.searchParams.set('options','-c search_path='+schema);
  const cliPath = new URL('../../brasil/backend/src/issue-driver-session.mjs',import.meta.url);
  const provision = spawnSync(process.execPath,[cliPath.pathname,sessionFile],{encoding:'utf8',
    env:{...process.env,DATABASE_URL:scoped.toString(),YATRI_DEVELOPMENT_MODE:'true',NODE_ENV:'development'}});
  assert.equal(provision.status,0,provision.stderr);
  const deviceSession=JSON.parse(await readFile(sessionFile,'utf8'));
  assert.equal((await stat(sessionFile)).mode & 0o777,0o600);
  assert.ok(!provision.stdout.includes(deviceSession.token));
  assert.equal((await service.authenticate(deviceSession.token)).id,driver.user.id);
  const denied=spawnSync(process.execPath,[cliPath.pathname,join(privateDir,'denied.json')],{encoding:'utf8',
    env:{...process.env,DATABASE_URL:scoped.toString(),YATRI_DEVELOPMENT_MODE:'true',NODE_ENV:'production'}});
  assert.notEqual(denied.status,0);

  const stored = await pool.query('SELECT token_hash FROM sessions');
  assert.ok(stored.rows.every(x => x.token_hash !== passenger.token && x.token_hash !== driver.token));
  await call('/driver/location', passenger.token, { lat: -23.55, lng: -46.63 }, 403);
  await call('/quotes', driver.token, {}, 403);
  // The exact Android driver's HTTP adapter, using persisted test identities and real HTTP.
  const driverClient = createOperationsClient({baseUrl:base.replace(/\/v1$/, ''), token:driver.token});
  const wrongClient = createOperationsClient({baseUrl:base.replace(/\/v1$/, ''), token:passenger.token});
  await assert.rejects(wrongClient.snapshot(), /motorista/);
  await driverClient.location(-23.55, -46.63);
  assert.equal((await driverClient.availability(true)).available, true);
  assert.equal((await driverClient.snapshot()).user.name, 'Giselo');
  const pilot=createDriverPilot({pool,enabled:true,nodeEnv:'development',until:new Date(Date.now()+3600000).toISOString(),maps});
  await new Promise(resolve=>pilot.listen(0,'127.0.0.1',resolve));
  try {
    const pilotBase='http://127.0.0.1:'+pilot.address().port;
    const activation=await issuePairing(pool);
    assert.equal((await pool.query('SELECT token_hash FROM sessions WHERE token_hash=$1',[pairingHash(activation.code)])).rowCount,1);
    await assert.rejects(service.authenticate(activation.code),e=>e.status===401);
    const paired=await fetch(pilotBase+'/v1/driver/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:activation.code})});
    assert.equal(paired.status,200);
    const pairedSession=await paired.json();
    assert.equal((await service.authenticate(pairedSession.token)).id,driver.user.id);
    assert.equal((await fetch(pilotBase+'/v1/driver/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:activation.code})})).status,401);
    const invalid=await fetch(pilotBase+'/v1/driver/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"code":"invalid"}'});
    assert.equal(invalid.status,401);
    const pilotClient=createOperationsClient({baseUrl:pilotBase,token:deviceSession.token});
    await pilotClient.location(-23.55,-46.63);
    assert.equal((await pilotClient.availability(true)).available,true);
    assert.equal((await pilotClient.snapshot()).user.name,'Giselo');
    const passengerAccess=await fetch(pilotBase+'/v1/snapshot',{headers:{Authorization:'Bearer '+passenger.token}});
    assert.equal(passengerAccess.status,200);
    assert.equal((await fetch(pilotBase+'/v1/development/session',{method:'POST'})).status,404);
    const passengerActivation=await issuePairing(pool,'passenger');
    assert.equal((await fetch(pilotBase+'/v1/driver/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:passengerActivation.code})})).status,401);
    const exchange=await fetch(pilotBase+'/v1/passenger/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:passengerActivation.code})});
    assert.equal(exchange.status,200);const passengerSession=await exchange.json();
    const pilotPassenger=createOperationsClient({baseUrl:pilotBase,token:passengerSession.token,role:'passenger'});
    const simulatedQuote=await pilotPassenger.quote({lat:-23.55,lng:-46.63,address:'Origem de teste'}, {lat:-23.56,lng:-46.64,address:'Destino de teste'});
    const requested=await pilotPassenger.requestRide(simulatedQuote.id);
    assert.equal((await pilotClient.snapshot()).offers[0].id,requested.id);
    await assert.rejects(pilotPassenger.rideAction(requested.id,'accept'),/permissão/);
    await pilotClient.rideAction(requested.id,'accept');
    const assigned=(await pilotPassenger.snapshot()).rides[0];
    assert.equal(assigned.id,requested.id);assert.equal(assigned.driver_name,'Giselo');assert.equal(assigned.plate,config.vehicle.plate);
    await pilotPassenger.rideAction(requested.id,'cancel');
    assert.equal((await pilotClient.snapshot()).rides.length,0);
    assert.equal((await pilotPassenger.ride(requested.id)).status,'cancelled');
    const nextQuote=await pilotPassenger.quote({lat:-23.55,lng:-46.63,address:'Embarque do teste de ciclo completo'}, {lat:-23.56,lng:-46.64,address:'Destino do teste de ciclo completo'});
    const next=await pilotPassenger.requestRide(nextQuote.id);
    await pilotClient.rideAction(next.id,'accept');
    await pilotClient.location(-23.551,-46.631);
    const beforeNavigation=mapsCalls;
    const paths=await Promise.all([pilotPassenger.navigation(next.id),pilotClient.navigation(next.id)]);
    assert.ok(paths.every(path=>path.leg==='pickup'));
    assert.equal(mapsCalls,beforeNavigation+1,'Both roles share one cached Google pickup route');
    await pool.query("UPDATE drivers SET location_at=now()-interval '2 minutes' WHERE user_id=$1",[driver.user.id]);
    await assert.rejects(pilotPassenger.navigation(next.id),/desatualizada/);
    await pilotClient.location(-23.551,-46.631);
    assert.equal((await pilotPassenger.ride(next.id)).driver_lat,-23.551);
    const unknown=randomUUID();
    await assert.rejects(pilotPassenger.navigation(unknown),/encontrada/);

    await assert.rejects(pilotClient.rideAction(next.id,'start'),/Transição/);
    for(const [action,status] of [['arrive','arrived'],['start','in_progress'],['complete','completed']]){
      await assert.rejects(pilotPassenger.rideAction(next.id,action),/Somente o motorista/);
      await pilotClient.rideAction(next.id,action);
      for(const participant of [pilotPassenger,pilotClient])assert.equal((await participant.ride(next.id)).status,status);
    }
    assert.equal((await pilotClient.snapshot()).rides.length,0);
    assert.equal((await pilotPassenger.snapshot()).rides.length,0);
    assert.equal((await pilotPassenger.navigation(next.id)).leg,'trip');
    assert.equal((await pool.query('SELECT status FROM rides WHERE id=$1',[next.id])).rows[0].status,'completed');
  } finally {
    pilot.closeAllConnections();await new Promise(resolve=>pilot.close(resolve));
  }
  const quote = await call('/quotes', passenger.token, { origin: { lat: -23.55, lng: -46.63, address: 'Origem do teste automatizado' }, destination: { lat: -23.56, lng: -46.64, address: 'Destino do teste automatizado' } });
  const ride = await call('/rides', passenger.token, { quoteId: quote.id });
  assert.equal((await call('/snapshot', driver.token)).offers[0].passenger_name, 'Fagner');
  for (const [action, status] of [['accept', 'accepted'], ['arrive', 'arrived'], ['start', 'in_progress'], ['complete', 'completed']]) {
    await driverClient.rideAction(ride.id, action);
    for (const user of [passenger, driver]) {
      const value = await call('/rides/' + ride.id, user.token);
      assert.equal(value.status, status); assert.equal(value.driver_name, 'Giselo'); assert.equal(value.passenger_name, 'Fagner');
    }
  }
  await call('/rides/' + ride.id + '/start', passenger.token, {}, 403);
  const nonDevelopment = mobilityService(pool, maps);
  await assert.rejects(nonDevelopment.authenticate(passenger.token), e => e.status === 401);
  await assert.rejects(nonDevelopment.authenticate(driver.token), e => e.status === 401);
  const disabled = await developmentAccounts(pool);
  assert.equal(disabled, null);
  await assert.rejects(developmentAccounts(pool, { ...config, driverKey: config.passengerKey }), /diferentes/);
  await assert.rejects(developmentAccounts(pool, { ...config, driverKey: '' }), /32 bytes/);
  await assert.rejects(developmentAccounts(pool, { ...config, vehicle: {} }), /veículo/);
});
