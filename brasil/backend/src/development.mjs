// Development-only accounts. Credentials are scoped to one role and never stored in plaintext.
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { transaction } from './db.mjs';
import { requireThat, tokenHash, passwordHash } from './domain.mjs';

const accounts = Object.freeze({
  passenger: { id: 'b1a51100-0000-4000-8000-000000000001', name: 'Fagner' },
  driver: { id: 'b1a51100-0000-4000-8000-000000000002', name: 'Giselo' }
});

export const isDevelopmentAccount = id => Object.values(accounts).some(account => account.id === id);

export async function developmentAccounts(pool, { enabled = false, passengerKey, driverKey, vehicle } = {}) {
  if (!enabled) return null;
  for (const key of [passengerKey, driverKey]) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Credenciais de desenvolvimento devem ter 32 bytes aleatórios em hexadecimal');
  }
  if (passengerKey === driverKey) throw new Error('As credenciais dos dois perfis precisam ser diferentes');
  if (!vehicle || !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(vehicle.plate || '') ||
      typeof vehicle.model !== 'string' || vehicle.model.length < 2 || vehicle.model.length > 80 ||
      typeof vehicle.color !== 'string' || vehicle.color.length < 2 || vehicle.color.length > 40) {
    throw new Error('Configure placa, modelo e cor do veículo de testes de Giselo');
  }
  const password = await passwordHash(randomBytes(32).toString('hex'));
  await transaction(pool, async db => {
    for (const [role, account] of Object.entries(accounts)) {
      const result = await db.query(`INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name RETURNING role`,
      [account.id, account.name, role + '@development.yatri.invalid', password, role]);
      if (result.rows[0].role !== role) throw new Error('Perfil de desenvolvimento inconsistente');
    }
    await db.query('INSERT INTO drivers(user_id) VALUES($1) ON CONFLICT DO NOTHING', [accounts.driver.id]);
    await db.query(`INSERT INTO vehicles(driver_id,plate,model,color) VALUES($1,$2,$3,$4)
      ON CONFLICT(driver_id) DO UPDATE SET plate=EXCLUDED.plate,model=EXCLUDED.model,color=EXCLUDED.color`,
    [accounts.driver.id, vehicle.plate, vehicle.model, vehicle.color]);
  });
  const hashes = { passenger: tokenHash(passengerKey), driver: tokenHash(driverKey) };
  return {
    async session(body) {
      const expected = Object.hasOwn(hashes, body.role) ? hashes[body.role] : undefined;
      const provided = tokenHash(typeof body.credential === 'string' ? body.credential : '');
      // Compare equal-size hashes even for invalid roles; no credential can choose the other user.
      const valid = timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected || '00'.repeat(32), 'hex'));
      requireThat(expected && valid, 401, 'Credencial de desenvolvimento inválida');
      const account = accounts[body.role];
      const token = randomBytes(32).toString('hex');
      await pool.query(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')`, [tokenHash(token), account.id]);
      return { token, user: { ...account, role: body.role } };
    }
  };
}
