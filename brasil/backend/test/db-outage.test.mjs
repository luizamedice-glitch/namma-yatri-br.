// Own disposable Docker databases only. Never reads a live DATABASE_URL.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,fork,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,generateKeyPairSync} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createServer} from 'node:net';
import pg from 'pg';
import {migrate} from '../src/migrate.mjs';
import {encryptBackup,decryptBackup} from '../ops/backup-crypto.mjs';
const environment={...process.env};for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete environment[key];
const docker=(...args)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env:environment,stdio:['pipe','pipe','pipe'],timeout:60000,maxBuffer:32*1024*1024});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('actual PostgreSQL outage rolls back uncommitted ride, API recovers, encrypted backup restores in another database',{timeout:180000},async t=>{
  const suffix=randomUUID().replaceAll('-',''),schema='recovery_'+suffix,names=[],children=[],pools=[];
  const dir=await mkdtemp(join(tmpdir(),'yatri-db-recovery-'));
  t.after(async()=>{
    for(const child of children)if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGKILL');await exited;}
    for(const pool of pools)await pool.end();
    for(const name of names)try{docker('rm','-f','-v',name);}catch{}
    await rm(dir,{recursive:true,force:true});
  });
  async function database(label){
    const name='yatri-dr-'+label+'-'+suffix;names.push(name);
    // Publish a fixed ephemeral host port: Docker otherwise reallocates :0 on restart.
    const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
    const assigned=socket.address().port;await new Promise(resolve=>socket.close(resolve));
    docker('run','-d','--name',name,'--label','yatri.isolated-recovery=true','-p','127.0.0.1:'+assigned+':5432','-e','POSTGRES_PASSWORD=dr-fixture-only','-e','POSTGRES_DB=isolated','postgres:16-alpine');
    await ready(name);const port=docker('port',name,'5432/tcp').toString().trim();assert.match(port,/^127\.0\.0\.1:\d+$/);
    return {name,url:'postgresql://postgres:dr-fixture-only@'+port+'/isolated'};
  }
  async function ready(name){for(let n=0;n<80;n++){try{docker('exec',name,'pg_isready','-h','127.0.0.1','-U','postgres','-d','isolated');return;}catch{}await delay(150);}throw Error('ISOLATED_POSTGRES_NOT_READY');}
  const source=await database('source');
  const pool=new pg.Pool({connectionString:source.url,options:'-c search_path='+schema});pools.push(pool);
  pool.on('error',()=>{}); // The test deliberately terminates this disposable DB.
  await pool.query('CREATE SCHEMA '+schema);await migrate(pool);
  async function api(url){
    const child=fork(new URL('./fixtures/recovery-server.mjs',import.meta.url),[],{env:{...process.env,DATABASE_URL:url,RECOVERY_SCHEMA:schema},stdio:['ignore','ignore','pipe','ipc']});children.push(child);
    let diagnostic='';child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-6000);});
    child.on('exit',code=>{if(code)console.error('Isolated API exit:',code,diagnostic.replace(/[a-f0-9]{64}/gi,'[REDACTED]'));});
    const [message]=await once(child,'message');assert.equal(message.type,'ready');
    return {child,base:'http://127.0.0.1:'+message.port};
  }
  const original=await api(source.url);
  async function call(api,path,token,body,status=200){
    const response=await fetch(api.base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
    const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return {value,response};
  }
  const register=async(role,plate)=>(await call(original,'/v1/auth/register',null,{name:'Fixture '+role,email:role+'@dr.test',role,password:'dr-password-fixture-only',inviteCode:'recovery-invite-fixture-only',...(plate?{vehicle:{plate,model:'Isolated test',color:'Prata'}}:{})})).value;
  const passenger=await register('passenger'),driver=await register('driver','TST1A23');
  await call(original,'/v1/driver/location',driver.token,{lat:-23.55,lng:-46.63});await call(original,'/v1/driver/availability',driver.token,{available:true});
  const quote=(await call(original,'/v1/quotes',passenger.token,{origin:{lat:-23.55,lng:-46.63,address:'Public fixture origin'},destination:{lat:-23.56,lng:-46.64,address:'Public fixture destination'}})).value;
  const ride=(await call(original,'/v1/rides',passenger.token,{quoteId:quote.id})).value;
  for(const action of ['accept','arrive','start'])await call(original,'/v1/rides/'+ride.id+'/'+action,driver.token,{});
  const before=(await call(original,'/v1/rides/'+ride.id,passenger.token)).value;
  const armed=once(original.child,'message');original.child.send({type:'hold-mutation'});await armed;
  const written=once(original.child,'message');
  const pending=call(original,'/v1/rides/'+ride.id+'/complete',driver.token,{},503);await written;
  docker('stop','-t','0',source.name);
  const failed=await pending;assert.equal(failed.response.headers.get('retry-after'),'5');assert.match(failed.value.error,/temporariamente/);
  const health=await call(original,'/health',null,undefined,503);assert.equal(health.value.status,'unavailable');
  assert.equal(original.child.exitCode,null,'API must survive broken PostgreSQL sockets');
  docker('start',source.name);await ready(source.name);
  for(let attempt=0;attempt<20;attempt++){
    if((await fetch(original.base+'/health')).status===200)break;
    await delay(200);
  }
  await call(original,'/health');
  const recovered=(await call(original,'/v1/rides/'+ride.id,passenger.token)).value;
  assert.equal(recovered.status,'in_progress');assert.equal(recovered.version,before.version);assert.equal(recovered.fare_cents,before.fare_cents);
  const dump=docker('exec',source.name,'pg_dump','-U','postgres','-d','isolated','-Fc','--no-owner','--no-acl');
  const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
  const sealed=join(dir,'backup.ybk'),plain=join(dir,'restored.dump');
  await encryptBackup(Readable.from([dump]),keys.publicKey,sealed);await decryptBackup(sealed,keys.privateKey,plain);
  assert.deepEqual(await readFile(plain),dump);
  const target=await database('restored');
  const restore=spawnSync('docker',['--host=unix:///var/run/docker.sock','exec','-i',target.name,'pg_restore','-U','postgres','-d','isolated','--no-owner','--no-acl','--exit-on-error'],{env:environment,input:await readFile(plain),stdio:['pipe','pipe','pipe'],timeout:60000});
  assert.equal(restore.status,0,'Restore into isolated database must finish');
  const restored=await api(target.url);
  const copy=(await call(restored,'/v1/rides/'+ride.id,passenger.token)).value;assert.deepEqual(copy,recovered);
  await call(restored,'/v1/rides/'+ride.id+'/complete',driver.token,{});
  assert.equal((await call(original,'/v1/rides/'+ride.id,passenger.token)).value.status,'in_progress','Restore must never replace the source database');
  await call(original,'/v1/rides/'+ride.id+'/complete',driver.token,{});
  const completed=(await call(original,'/v1/rides/'+ride.id,passenger.token)).value;
  await call(original,'/v1/rides/'+ride.id+'/complete',driver.token,{});
  assert.equal((await call(original,'/v1/rides/'+ride.id,passenger.token)).value.version,completed.version);
  await writeFile('db-resilience-evidence.json',JSON.stringify({passed:true,databaseUnavailableHttp:503,apiProcessSurvived:true,uncommittedMutationRolledBack:true,sessionSurvived:true,encryptedDumpRestored:true,restoreIsolated:true,sourceRideCompletedOnce:true},null,2));
});
