// Exercises the executable server, not a fixture server. Requires a disposable DB.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { connectDatabase } from '../src/db.mjs';
import { migrate } from '../src/migrate.mjs';
assert.ok(process.env.DATABASE_URL, 'Use DATABASE_URL de um banco exclusivo de testes');
const pool = await connectDatabase(process.env.DATABASE_URL);
try { await migrate(pool); } finally { await pool.end(); }
const invite = 'cli-test-invite-123456789';
const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0', HOST: '127.0.0.1', TEST_INVITE_CODE: invite, GOOGLE_MAPS_SERVER_KEY: '' }, stdio: ['ignore','pipe','pipe'] });
try {
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Servidor não iniciou em 15 segundos')), 15000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Servidor encerrou antes de iniciar')); });
    child.stdout.on('data', chunk => {
      output += chunk.toString(); const match = output.match(/API porta (\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    });
    // Do not dump the subprocess environment or database connection details.
    child.stderr.resume();
  });
  const base = 'http://127.0.0.1:' + port;
  assert.equal((await fetch(base + '/health')).status, 200);
  const register = await fetch(base + '/v1/auth/register', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name:'Conta CLI de teste',email:randomUUID()+'@teste.local',password:'cli-test-password-123',role:'passenger',inviteCode:invite }) });
  assert.equal(register.status, 200); const { token } = await register.json();
  const quote = await fetch(base + '/v1/quotes', { method: 'POST', headers: { 'Content-Type':'application/json',Authorization:'Bearer '+token }, body: JSON.stringify({ origin:{lat:-23.55,lng:-46.63,address:'Origem de teste'},destination:{lat:-23.56,lng:-46.64,address:'Destino de teste'} }) });
  assert.equal(quote.status, 503, 'Servidor sem chave Google não pode produzir cotação');
  console.log('CLI real + PostgreSQL: migrations, startup, health, cadastro e ausência explícita de mapas verificados');
} finally {
  if (child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; }
}
