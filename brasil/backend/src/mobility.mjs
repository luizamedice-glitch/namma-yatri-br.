import { randomUUID } from 'node:crypto';
import { isDevelopmentAccount } from './development.mjs';
import { transaction } from './db.mjs';
import { requireThat, text, point, position, uuid, passwordHash, verifyPassword, newToken, tokenHash, transition } from './domain.mjs';

const rideSelect = `SELECT r.id, r.passenger_id, r.driver_id, r.status, r.version,
 r.created_at, r.updated_at, q.origin, q.destination, q.route, q.fare_cents,
 p.name AS passenger_name, d.name AS driver_name, v.plate, v.model, v.color,
 CASE WHEN r.status IN ('accepted','arrived','in_progress') THEN dl.lat END AS driver_lat,
 CASE WHEN r.status IN ('accepted','arrived','in_progress') THEN dl.lng END AS driver_lng,
 CASE WHEN r.status IN ('accepted','arrived','in_progress') THEN dl.location_at END AS driver_location_at
 FROM rides r JOIN quotes q ON q.id=r.quote_id JOIN users p ON p.id=r.passenger_id
 LEFT JOIN users d ON d.id=r.driver_id LEFT JOIN vehicles v ON v.driver_id=r.driver_id
 LEFT JOIN drivers dl ON dl.user_id=r.driver_id`;

export function mobilityService(pool, maps, { inviteCode, radiusMeters = 5000, allowDevelopmentAccounts = false } = {}) {
  const role = (u, value) => requireThat(u.role === value, 403, 'Perfil sem permissão');
  async function event(db, userId, kind, payload = {}) {
    await db.query('INSERT INTO events(user_id,kind,payload) VALUES($1,$2,$3)', [userId, kind, payload]);
  }
  async function notifyRide(db, r) {
    const recipients = new Set([r.passenger_id, r.driver_id].filter(Boolean));
    const offers = await db.query('SELECT driver_id FROM offers WHERE ride_id=$1', [r.id]);
    offers.rows.forEach(x => recipients.add(x.driver_id));
    for (const id of recipients) await event(db, id, 'ride.updated', { rideId: r.id, status: r.status, version: r.version });
  }
  async function dispatch(db) {
    // Expire unmatched requests after 10 minutes, including across server restarts.
    const expired = await db.query(`UPDATE rides SET status='cancelled', version=version+1, updated_at=now()
      WHERE status='searching' AND created_at < now()-interval '10 minutes' RETURNING *`);
    for (const r of expired.rows) await notifyRide(db, r);
    const result = await db.query(`INSERT INTO offers(ride_id,driver_id)
      SELECT r.id,d.user_id FROM rides r JOIN quotes q ON q.id=r.quote_id
      CROSS JOIN drivers d WHERE r.status='searching' AND d.available=true
      AND d.location_at > now()-interval '60 seconds'
      AND NOT EXISTS (SELECT 1 FROM rides busy WHERE busy.driver_id=d.user_id AND busy.status IN ('accepted','arrived','in_progress'))
      AND 6371000 * 2 * asin(sqrt(least(1.0,
        power(sin(radians(d.lat-(q.origin->>'lat')::float8)/2),2) +
        cos(radians(d.lat))*cos(radians((q.origin->>'lat')::float8))*
        power(sin(radians(d.lng-(q.origin->>'lng')::float8)/2),2)))) <= $1
      ON CONFLICT DO NOTHING RETURNING ride_id,driver_id`, [radiusMeters]);
    for (const o of result.rows) await event(db, o.driver_id, 'offer.created', { rideId: o.ride_id });
  }
  async function session(db, user) {
    const token = newToken();
    await db.query('INSERT INTO sessions(token_hash,user_id) VALUES($1,$2)', [tokenHash(token), user.id]);
    return { token, user: { id: user.id, name: user.name, role: user.role } };
  }
  return {
    async register(body) {
      requireThat(inviteCode && body.inviteCode === inviteCode, 403, 'Convite de testes inválido');
      const name = text(body.name, 'Nome', 2, 100);
      const email = text(body.email, 'Email', 5, 200).toLowerCase();
      requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Email inválido');
      requireThat(['driver', 'passenger'].includes(body.role), 400, 'Perfil inválido');
      let vehicle;
      if (body.role === 'driver') {
        vehicle = { plate: text(body.vehicle?.plate, 'Placa', 7, 7).toUpperCase(), model: text(body.vehicle?.model, 'Modelo', 2, 80), color: text(body.vehicle?.color, 'Cor', 2, 40) };
        requireThat(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(vehicle.plate), 400, 'Placa brasileira inválida');
      }
      const hash = await passwordHash(body.password);
      return transaction(pool, async db => {
        const user = { id: randomUUID(), name, role: body.role };
        await db.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [user.id, name, email, hash, user.role]);
        if (vehicle) {
          await db.query('INSERT INTO drivers(user_id) VALUES($1)', [user.id]);
          await db.query('INSERT INTO vehicles(driver_id,plate,model,color) VALUES($1,$2,$3,$4)', [user.id, vehicle.plate, vehicle.model, vehicle.color]);
        }
        return session(db, user);
      });
    },
    async login(body) {
      const email = text(body.email, 'Email', 5, 200).toLowerCase();
      const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
      // Run scrypt even for an unknown account to reduce account enumeration.
      const user = result.rows[0];
      const fallback = '00000000000000000000000000000000:' + '00'.repeat(64);
      const valid = await verifyPassword(body.password, user?.password_hash || fallback);
      requireThat(user && valid, 401, 'Email ou senha incorretos');
      return session(pool, user);
    },
    async authenticate(token) {
      requireThat(typeof token === 'string' && /^[a-f0-9]{64}$/.test(token), 401, 'Autenticação necessária');
      const r = await pool.query('SELECT u.id,u.name,u.role,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [tokenHash(token)]);
      requireThat(r.rowCount, 401, 'Sessão expirada');
      requireThat(allowDevelopmentAccounts || !isDevelopmentAccount(r.rows[0].id), 401, 'Sessão de desenvolvimento desabilitada');
      return r.rows[0];
    },
    async logout(token) { await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]); return {}; },
    async availability(user, body) {
      role(user, 'driver');
      requireThat(typeof body.available === 'boolean', 400, 'Disponibilidade inválida');
      return transaction(pool, async db => {
        if (body.available) {
          const fresh = await db.query(`SELECT 1 FROM drivers WHERE user_id=$1 AND location_at>now()-interval '60 seconds'`, [user.id]);
          requireThat(fresh.rowCount, 409, 'Atualize sua localização antes de ficar disponível');
        }
        await db.query('UPDATE drivers SET available=$2 WHERE user_id=$1', [user.id, body.available]);
        await dispatch(db);
        return { available: body.available };
      });
    },
    async location(user, body) {
      role(user, 'driver'); const p = position(body);
      return transaction(pool, async db => {
        await db.query('UPDATE drivers SET lat=$2,lng=$3,location_at=now() WHERE user_id=$1', [user.id, p.lat, p.lng]);
        const active = await db.query(`SELECT * FROM rides WHERE driver_id=$1 AND status IN ('accepted','arrived','in_progress')`, [user.id]);
        for (const r of active.rows) await event(db, r.passenger_id, 'driver.location', { rideId: r.id });
        await dispatch(db); return { received: true };
      });
    },
    async quote(user, body) {
      role(user, 'passenger'); const origin = point(body.origin), destination = point(body.destination);
      const route = await maps.route(origin, destination);
      const id = randomUUID();
      const r = await pool.query('INSERT INTO quotes(id,passenger_id,origin,destination,route,fare_cents) VALUES($1,$2,$3,$4,$5,$6) RETURNING expires_at', [id, user.id, origin, destination, route, route.fareCents]);
      return { id, origin, destination, route, fareCents: route.fareCents, expiresAt: r.rows[0].expires_at };
    },
    async requestRide(user, body) {
      role(user, 'passenger'); const quoteId = uuid(body.quoteId);
      return transaction(pool, async db => {
        const existing = await db.query('SELECT id FROM rides WHERE quote_id=$1 AND passenger_id=$2', [quoteId, user.id]);
        if (existing.rowCount) return { id: existing.rows[0].id };
        const q = await db.query('SELECT id FROM quotes WHERE id=$1 AND passenger_id=$2 AND expires_at>now()', [quoteId, user.id]);
        requireThat(q.rowCount, 409, 'Cotação expirada ou indisponível; calcule a rota novamente');
        const id = randomUUID();
        const r = await db.query(`INSERT INTO rides(id,passenger_id,quote_id,status) VALUES($1,$2,$3,'searching') RETURNING *`, [id, user.id, quoteId]);
        await event(db, user.id, 'ride.updated', { rideId: id, status: 'searching' });
        await dispatch(db); return { id: r.rows[0].id };
      });
    },
    async accept(user, id) {
      role(user, 'driver'); uuid(id);
      return transaction(pool, async db => {
        const existing = await db.query('SELECT * FROM rides WHERE id=$1', [id]);
        requireThat(existing.rowCount, 404, 'Corrida não encontrada');
        const ride = existing.rows[0];
        if (ride.driver_id === user.id && ['accepted', 'arrived', 'in_progress'].includes(ride.status)) return { id, status: ride.status };
        requireThat(ride.status === 'searching', 409, 'Oferta já encerrada');
        const valid = await db.query(`SELECT 1 FROM offers o JOIN drivers d ON d.user_id=o.driver_id
          JOIN rides r ON r.id=o.ride_id JOIN quotes q ON q.id=r.quote_id
          WHERE o.ride_id=$1 AND o.driver_id=$2 AND NOT o.rejected AND d.available
          AND d.location_at>now()-interval '60 seconds'
          AND r.created_at>now()-interval '10 minutes'
          AND 6371000 * 2 * asin(sqrt(least(1.0,
            power(sin(radians(d.lat-(q.origin->>'lat')::float8)/2),2) +
            cos(radians(d.lat))*cos(radians((q.origin->>'lat')::float8))*
            power(sin(radians(d.lng-(q.origin->>'lng')::float8)/2),2)))) <= $3`, [id, user.id, radiusMeters]);
        requireThat(valid.rowCount, 409, 'Oferta indisponível ou localização desatualizada');
        const updated = await db.query(`UPDATE rides SET driver_id=$2,status='accepted',version=version+1,updated_at=now() WHERE id=$1 RETURNING *`, [id, user.id]);
        await notifyRide(db, updated.rows[0]); return { id, status: 'accepted' };
      });
    },
    async reject(user, id) {
      role(user, 'driver'); uuid(id);
      return transaction(pool, async db => {
        const r = await db.query('UPDATE offers SET rejected=true WHERE ride_id=$1 AND driver_id=$2 RETURNING *', [id, user.id]);
        requireThat(r.rowCount, 404, 'Oferta não encontrada');
        await event(db, user.id, 'offer.rejected', { rideId: id }); return {};
      });
    },
    async change(user, id, action) {
      uuid(id);
      return transaction(pool, async db => {
        const r = await db.query('SELECT * FROM rides WHERE id=$1 FOR UPDATE', [id]);
        requireThat(r.rowCount, 404, 'Corrida não encontrada');
        const status = transition(r.rows[0], user, action);
        const updated = await db.query('UPDATE rides SET status=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *', [id, status]);
        await notifyRide(db, updated.rows[0]); await dispatch(db); return { id, status };
      });
    },
    async ride(user, id) {
      uuid(id);
      const r = await pool.query(rideSelect + ' WHERE r.id=$1 AND (r.passenger_id=$2 OR r.driver_id=$2)', [id, user.id]);
      requireThat(r.rowCount, 404, 'Corrida não encontrada'); return r.rows[0];
    },
    async snapshot(user) {
      const rides = await pool.query(rideSelect + ` WHERE (r.passenger_id=$1 OR r.driver_id=$1) AND r.status IN ('searching','accepted','arrived','in_progress') ORDER BY r.created_at DESC`, [user.id]);
      let offers = [], available = false;
      if (user.role === 'driver') {
        const d = await pool.query(`SELECT available AND location_at>now()-interval '60 seconds' AS available FROM drivers WHERE user_id=$1`, [user.id]);
        available = Boolean(d.rows[0]?.available);
        if (available && !rides.rowCount) {
          const o = await pool.query(rideSelect + ` JOIN offers o ON o.ride_id=r.id
            WHERE o.driver_id=$1 AND NOT o.rejected AND r.status='searching' AND r.created_at>now()-interval '10 minutes'
            AND EXISTS (SELECT 1 FROM drivers current_driver WHERE current_driver.user_id=$1
              AND 6371000 * 2 * asin(sqrt(least(1.0,
                power(sin(radians(current_driver.lat-(q.origin->>'lat')::float8)/2),2) +
                cos(radians(current_driver.lat))*cos(radians((q.origin->>'lat')::float8))*
                power(sin(radians(current_driver.lng-(q.origin->>'lng')::float8)/2),2)))) <= $2)
            ORDER BY r.created_at LIMIT 20`, [user.id, radiusMeters]);
          offers = o.rows;
        }
      }
      return { user: { id: user.id, name: user.name, role: user.role }, available, rides: rides.rows, offers };
    },
    async history(user) {
      return (await pool.query(rideSelect + ' WHERE r.passenger_id=$1 OR r.driver_id=$1 ORDER BY r.created_at DESC LIMIT 100', [user.id])).rows;
    },
    async events(user, cursor) {
      return (await pool.query('SELECT id,kind,payload FROM events WHERE user_id=$1 AND id>$2 ORDER BY id LIMIT 100', [user.id, cursor])).rows;
    },
    async dispatch() { return transaction(pool, dispatch); }
  };
}
