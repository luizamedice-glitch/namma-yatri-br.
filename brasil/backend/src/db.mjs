export async function connectDatabase(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL é obrigatória');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  // pg-pool removes its idle error listener while a client is checked out.
  // A second socket error after an interrupted query must not terminate Node.
  // Queries still reject normally; the affected client is never reused.
  pool.on('connect',client=>client.on('error',()=>{client.yatriConnectionBroken=true;}));
  pool.on('error', error => console.error('Conexão PostgreSQL interrompida:', error.code || error.name));
  await pool.query('SELECT 1');
  return pool;
}
// Lock shared by dispatch, availability and all ride mutations. Deliberately simple
// for a local pilot: serializes allocation across processes, not just one Node instance.
export async function transaction(pool, fn) {
  const db = await pool.connect();
  let discard = false;
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(720214)');
    const value = await fn(db);
    await db.query('COMMIT');
    return value;
  } catch (e) {
    try { await db.query('ROLLBACK'); } catch { discard = true; }
    throw e;
  }
  finally { db.release(discard || db.yatriConnectionBroken ? new Error('DATABASE_CONNECTION_LOST') : undefined); }
}

export function databaseUnavailable(error) {
  const code=String(error?.code||'');
  return /^(08[0-9A-Z]{3}|57P0[123]|53300|57014|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EPIPE)$/.test(code)
    || /^(Connection terminated|Client has encountered a connection error|timeout exceeded when trying to connect)/i.test(String(error?.message||''));
}
