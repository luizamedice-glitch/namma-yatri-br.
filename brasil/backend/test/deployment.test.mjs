import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { connectDatabase } from '../src/db.mjs';
import { migrate } from '../src/migrate.mjs';

test('deployment check: real DB, read-only inspection, rejects missing migrations and automatic accounts', async () => {
  const admin = await connectDatabase(process.env.DATABASE_URL);
  const schema = 'deployment_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  const env = { ...process.env, PGOPTIONS: `-c search_path=${schema}`, TEST_INVITE_CODE: 'deployment-test-invite-only', YATRI_DEVELOPMENT_MODE: 'false', GOOGLE_MAPS_SERVER_KEY: 'test-sensitive-value-never-print' };
  const run = extra => {
    const result = spawnSync(process.execPath, ['src/deployment-check.mjs'], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 10000 });
    const output = result.stdout + result.stderr;
    for (const secret of [env.TEST_INVITE_CODE, env.GOOGLE_MAPS_SERVER_KEY, env.DATABASE_URL]) assert.ok(!output.includes(secret), 'diagnostic must not contain secrets');
    assert.equal(result.error, undefined);
    return { status: result.status, output };
  };
  try {
    assert.equal(run().status, 1, 'missing schema must fail');
    await migrate(pool);
    const before = await pool.query('SELECT count(*)::integer AS count FROM users');
    const result = run(); assert.equal(result.status, 0, result.output);
    assert.equal(JSON.parse(result.output).googleMapsServerKeyConfigured, true);
    assert.equal(run({ YATRI_DEVELOPMENT_MODE: 'true' }).status, 1);
    assert.equal(run({ TEST_INVITE_CODE: '' }).status, 1);
    await pool.query("INSERT INTO migrations(name) VALUES('999_unknown.sql')");
    assert.equal(run().status, 1, 'unknown migration prevents incompatible deployment');
    assert.deepEqual((await pool.query('SELECT count(*)::integer AS count FROM users')).rows, before.rows);
  } finally {
    await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  }
});
