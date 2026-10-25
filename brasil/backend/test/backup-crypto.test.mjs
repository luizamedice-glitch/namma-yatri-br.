import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,writeFile,stat,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {encryptBackup,decryptBackup} from '../ops/backup-crypto.mjs';
const keys=()=>generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
test('encrypted backup roundtrip, wrong key, tampering and truncation never publish unauthenticated plaintext',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'yatri-crypto-')),key=keys(),other=keys();
  try{
    const plain=Buffer.concat([Buffer.from('fixture-only-no-real-user-data'),randomBytes(180000)]);
    const encrypted=join(dir,'backup.ybk'),out=join(dir,'plain.dump');
    await encryptBackup(Readable.from([plain.subarray(0,60000),plain.subarray(60000)]),key.publicKey,encrypted);
    assert.equal((await stat(encrypted)).mode&0o777,0o600);
    const bytes=await readFile(encrypted);assert.equal(bytes.includes(plain.subarray(0,28)),false);
    await decryptBackup(encrypted,key.privateKey,out);assert.deepEqual(await readFile(out),plain);
    await assert.rejects(()=>decryptBackup(encrypted,key.privateKey,out));assert.deepEqual(await readFile(out),plain);
    await assert.rejects(()=>encryptBackup(Readable.from([plain]),key.publicKey,encrypted));assert.deepEqual(await readFile(encrypted),bytes);
    for(const [name,data,privateKey] of [['wrong-key',bytes,other.privateKey],['truncated',bytes.subarray(0,bytes.length-8),key.privateKey],['changed-tag',Buffer.from(bytes),key.privateKey]]){
      if(name==='changed-tag')data[data.length-1]^=1;
      const file=join(dir,name+'.ybk'),dest=join(dir,name+'.dump');await writeFile(file,data);
      await assert.rejects(()=>decryptBackup(file,privateKey,dest));await assert.rejects(()=>access(dest));
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
