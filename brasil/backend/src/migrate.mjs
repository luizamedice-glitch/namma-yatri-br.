import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { connectDatabase, transaction } from './db.mjs';
export async function migrate(pool) {
  const dir = new URL('../migrations/', import.meta.url);
  await transaction(pool, async db => {
    await db.query('CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const name of (await readdir(fileURLToPath(dir))).filter(n => n.endsWith('.sql')).sort()) {
      const applied = await db.query('SELECT name FROM migrations WHERE name=$1', [name]);
      if (!applied.rowCount) {
        await db.query(await readFile(new URL(name, dir), 'utf8'));
        await db.query('INSERT INTO migrations(name) VALUES($1)', [name]);
      }
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = await connectDatabase(process.env.DATABASE_URL);
  try { await migrate(pool); console.log('Migrations aplicadas'); } finally { await pool.end(); }
}
