export async function connectDatabase(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL é obrigatória');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await pool.query('SELECT 1');
  return pool;
}
// Lock shared by dispatch, availability and all ride mutations. Deliberately simple
// for a local pilot: serializes allocation across processes, not just one Node instance.
export async function transaction(pool, fn) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(720214)');
    const value = await fn(db);
    await db.query('COMMIT');
    return value;
  } catch (e) { await db.query('ROLLBACK'); throw e; }
  finally { db.release(); }
}
