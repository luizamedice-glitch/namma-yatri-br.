// SPDX-License-Identifier: AGPL-3.0-or-later
import {randomBytes} from 'node:crypto';
import {transaction} from './db.mjs';
import {requireThat,tokenHash,newToken} from './domain.mjs';
const DRIVER='b1a51100-0000-4000-8000-000000000002';
export const pairingHash=code=>tokenHash('driver-pair:'+code);
export async function issuePairing(pool){
  const code=randomBytes(16).toString('hex');
  const expiry=await transaction(pool,async db=>{
    const user=await db.query("SELECT 1 FROM users u JOIN vehicles v ON v.driver_id=u.id JOIN drivers d ON d.user_id=u.id WHERE u.id=$1 AND u.name='Giselo' AND u.role='driver'",[DRIVER]);
    requireThat(user.rowCount===1,409,'Cadastre motorista e veiculo antes de emitir a ativacao');
    const result=await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '24 hours') RETURNING expires_at",[pairingHash(code),DRIVER]);
    return result.rows[0].expires_at;
  });
  return {code,expiresAt:new Date(expiry).toISOString()};
}
export async function exchangePairing(pool,body){
  const code=String(body?.code||'').replace(/[\s-]/g,'').toLowerCase();
  requireThat(/^[a-f0-9]{32}$/.test(code),401,'Codigo de conexao invalido ou expirado');
  return transaction(pool,async db=>{
    const found=await db.query('DELETE FROM sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now() RETURNING user_id',[pairingHash(code),DRIVER]);
    requireThat(found.rowCount===1,401,'Codigo de conexao invalido, utilizado ou expirado');
    const token=newToken();
    const result=await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '24 hours') RETURNING expires_at",[tokenHash(token),DRIVER]);
    return {token,expiresAt:new Date(result.rows[0].expires_at).toISOString()};
  });
}
