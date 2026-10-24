// Operator-only provisioning for private development installations. Never bundled into APKs.
import {randomBytes} from 'node:crypto';
import {writeFile,unlink} from 'node:fs/promises';
import {connectDatabase} from './db.mjs';
if(process.env.NODE_ENV === 'production' || process.env.YATRI_DEVELOPMENT_MODE !== 'true')
  throw Error('Sessão automática permitida somente no backend de desenvolvimento explicitamente habilitado.');
const output=process.argv[2];
if(!output)throw Error('Informe um arquivo privado de saída fora do repositório.');
const pool=await connectDatabase(process.env.DATABASE_URL);
try{
  const row=await pool.query("SELECT id,name,role FROM users WHERE id=$1 AND role='driver'",['b1a51100-0000-4000-8000-000000000002']);
  if(row.rowCount !== 1 || row.rows[0].name !== 'Giselo')throw Error('Provisione Giselo e seu veículo no backend antes de emitir a sessão.');
  const token=randomBytes(32).toString('hex');
  await writeFile(output,JSON.stringify({token}),{mode:0o600,flag:'wx'});
  try{
    const {tokenHash}=await import('./domain.mjs');
    await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '24 hours')",[tokenHash(token),row.rows[0].id]);
  }catch(error){await unlink(output);throw error;}
  console.log('Sessão de motorista emitida por 24 horas em arquivo privado.');
}finally{await pool.end();}
