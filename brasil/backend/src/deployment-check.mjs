// Read-only readiness inspection for the existing server. Never print environment values.
import { readdir } from 'node:fs/promises';
import { connectDatabase } from './db.mjs';

let pool;
try {
  pool = await connectDatabase(process.env.DATABASE_URL);
  const expected = (await readdir(new URL('../migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort();
  const applied = (await pool.query('SELECT name FROM migrations ORDER BY name')).rows.map(row => row.name);
  if (JSON.stringify(expected) !== JSON.stringify(applied)) throw new Error('MIGRATIONS_MISMATCH');
  const tables = ['users', 'sessions', 'vehicles', 'drivers', 'quotes', 'rides', 'offers', 'events'];
  for (const table of tables) {
    const { rows } = await pool.query('SELECT to_regclass($1) IS NOT NULL AS present', [table]);
    if (!rows[0].present) throw new Error('SCHEMA_INCOMPLETE');
  }
  const developmentMode = process.env.YATRI_DEVELOPMENT_MODE === 'true';
  if (developmentMode) throw new Error('AUTOMATIC_ACCOUNTS_REQUIRE_SEPARATE_REVIEW');
  if (!process.env.TEST_INVITE_CODE || process.env.TEST_INVITE_CODE.length < 16) throw new Error('INVITE_CONFIGURATION_MISSING');
  console.log(JSON.stringify({ database: 'ready', migrations: applied, tables: tables.length,
    developmentMode, googleMapsServerKeyConfigured: Boolean(process.env.GOOGLE_MAPS_SERVER_KEY) }));
} catch (error) {
  const known = ['MIGRATIONS_MISMATCH', 'SCHEMA_INCOMPLETE', 'AUTOMATIC_ACCOUNTS_REQUIRE_SEPARATE_REVIEW', 'INVITE_CONFIGURATION_MISSING'];
  console.error(JSON.stringify({ ready: false, reason: known.includes(error.message) ? error.message : 'DATABASE_INSPECTION_FAILED' }));
  process.exitCode = 1;
} finally { if (pool) await pool.end(); }
