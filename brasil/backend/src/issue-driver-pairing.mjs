// Operator-only. Only ciphertext goes to stdout; plaintext never leaves SSH unencrypted.
import {readFileSync} from 'node:fs';
import {publicEncrypt,constants,createPublicKey} from 'node:crypto';
import {connectDatabase} from './db.mjs';
import {issuePairing} from './driver-pairing.mjs';
let pool;
try{
  if(process.env.YATRI_DRIVER_PILOT_MODE!=='true'||process.env.NODE_ENV==='production')throw Error('DRIVER_PILOT_DISABLED');
  const key=createPublicKey(readFileSync(0,'utf8'));
  if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails.modulusLength<3072)throw Error('INVALID_DELIVERY_KEY');
  pool=await connectDatabase(process.env.DATABASE_URL);
  const payload=await issuePairing(pool,process.argv[2]||'driver');
  process.stdout.write(publicEncrypt({key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(JSON.stringify(payload))).toString('base64'));
}catch(e){console.error('Nao foi possivel emitir a ativacao privada.');process.exitCode=1;}
finally{if(pool)await pool.end();}
