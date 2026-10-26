// SPDX-License-Identifier: AGPL-3.0-or-later
// Streaming RSA-OAEP/SHA256 + AES-256-GCM. No database data or keys in logs.
import {createPublicKey,createPrivateKey,publicEncrypt,privateDecrypt,constants,randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {open,readFile,unlink,link} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const magic=Buffer.from('YATRI-BACKUP-1\n');
const fingerprint=key=>createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
const rsa={padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'};
export async function encryptBackup(input,publicPem,output){
  const pub=createPublicKey(publicPem);
  if(pub.asymmetricKeyType!=='rsa'||pub.asymmetricKeyDetails.modulusLength<2048||pub.asymmetricKeyDetails.modulusLength>8192)throw Error('INVALID_RECIPIENT');
  const secret=randomBytes(32),iv=randomBytes(12);let file;
  try{
    const header=Buffer.from(JSON.stringify({cipher:'AES-256-GCM',keyId:fingerprint(pub),createdAt:new Date().toISOString(),iv:iv.toString('base64'),wrappedKey:publicEncrypt({key:pub,...rsa},secret).toString('base64')}));
    const length=Buffer.alloc(4);length.writeUInt32BE(header.length);
    const prefix=Buffer.concat([magic,length,header]);
    const cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(prefix);
    file=await open(output,'wx',0o600);await file.writeFile(prefix);
    for await(const chunk of input)await file.writeFile(cipher.update(chunk));
    await file.writeFile(cipher.final());await file.writeFile(cipher.getAuthTag());await file.sync();
  }catch(error){if(file){await file.close();file=null;await unlink(output).catch(()=>{});}throw error;}
  finally{secret.fill(0);if(file)await file.close();}
}
export async function decryptBackup(input,privatePem,output){
  const source=await open(input,'r');let file,temporary,secret;
  try{
    const size=(await source.stat()).size,initial=Buffer.alloc(magic.length+4);
    if((await source.read(initial,0,initial.length,0)).bytesRead!==initial.length||!initial.subarray(0,magic.length).equals(magic))throw Error('INVALID_ENVELOPE');
    const length=initial.readUInt32BE(magic.length);
    if(length<20||length>16384||size<initial.length+length+16)throw Error('INVALID_ENVELOPE');
    const bytes=Buffer.alloc(length);if((await source.read(bytes,0,length,initial.length)).bytesRead!==length)throw Error('INVALID_ENVELOPE');
    const header=JSON.parse(bytes.toString()),priv=createPrivateKey(privatePem),pub=createPublicKey(priv);
    if(header.cipher!=='AES-256-GCM'||header.keyId!==fingerprint(pub))throw Error('WRONG_RECIPIENT');
    secret=privateDecrypt({key:priv,...rsa},Buffer.from(header.wrappedKey,'base64'));
    const decipher=createDecipheriv('aes-256-gcm',secret,Buffer.from(header.iv,'base64'));
    decipher.setAAD(Buffer.concat([initial,bytes]));
    const tag=Buffer.alloc(16);await source.read(tag,0,16,size-16);decipher.setAuthTag(tag);
    temporary=output+'.part-'+randomBytes(8).toString('hex');file=await open(temporary,'wx',0o600);
    const start=initial.length+length;
    if(size-16>start)for await(const chunk of source.createReadStream({start,end:size-17,autoClose:false}))await file.writeFile(decipher.update(chunk));
    await file.writeFile(decipher.final());await file.sync();await file.close();file=null;
    // Publish plaintext only after authentication succeeds, never overwrite a file.
    await link(temporary,output);
  }finally{
    if(secret)secret.fill(0);if(file)await file.close();await source.close();
    if(temporary)await unlink(temporary).catch(()=>{});
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  process.umask(0o077);
  try{
    const [operation,keyFile,input,output]=process.argv.slice(2);
    if(operation==='encrypt'&&keyFile&&input&&output===undefined)await encryptBackup(process.stdin,await readFile(keyFile),input);
    else if(operation==='decrypt'&&keyFile&&input&&output)await decryptBackup(input,await readFile(keyFile),output);
    else throw Error('INVALID_ARGUMENTS');
    console.log(JSON.stringify({backupCrypto:true,operation}));
  }catch{console.error('Backup criptografado inválido ou operação não concluída.');process.exitCode=1;}
}
