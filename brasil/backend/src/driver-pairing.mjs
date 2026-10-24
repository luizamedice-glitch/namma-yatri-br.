// SPDX-License-Identifier: AGPL-3.0-or-later
import {randomBytes} from 'node:crypto';
import {transaction} from './db.mjs';
import {requireThat,tokenHash,newToken} from './domain.mjs';
const DRIVER='b1a51100-0000-4000-8000-000000000002';
const profiles={driver:{id:DRIVER,name:'Giselo'},passenger:{id:'b1a51100-0000-4000-8000-000000000001',name:'Fagner'}};
function profile(role){requireThat(Object.hasOwn(profiles,role),400,'Perfil invalido');return profiles[role];}
export const pairingHash=(code,role='driver')=>tokenHash(role+'-pair:'+code);
export async function issuePairing(pool,role='driver'){
  const selected=profile(role);
  const code=randomBytes(16).toString('hex');
  const expiry=await transaction(pool,async db=>{
    const user=await db.query("SELECT 1 FROM users u WHERE u.id=$1 AND u.name=$2 AND u.role=$3 AND ($3='passenger' OR EXISTS(SELECT 1 FROM vehicles v JOIN drivers d ON d.user_id=v.driver_id WHERE v.driver_id=u.id))",[selected.id,selected.name,role]);
    requireThat(user.rowCount===1,409,'Cadastre motorista e veiculo antes de emitir a ativacao');
    const result=await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '24 hours') RETURNING expires_at",[pairingHash(code,role),selected.id]);
    return result.rows[0].expires_at;
  });
  return {code,role,expiresAt:new Date(expiry).toISOString()};
}
export async function exchangePairing(pool,body,role='driver'){
  const selected=profile(role);
  const code=String(body?.code||'').replace(/[\s-]/g,'').toLowerCase();
  requireThat(/^[a-f0-9]{32}$/.test(code),401,'Codigo de conexao invalido ou expirado');
  return transaction(pool,async db=>{
    const found=await db.query('DELETE FROM sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now() RETURNING user_id',[pairingHash(code,role),selected.id]);
    requireThat(found.rowCount===1,401,'Codigo de conexao invalido, utilizado ou expirado');
    const token=newToken();
    const result=await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '24 hours') RETURNING expires_at",[tokenHash(token),selected.id]);
    return {token,expiresAt:new Date(result.rows[0].expires_at).toISOString()};
  });
}
