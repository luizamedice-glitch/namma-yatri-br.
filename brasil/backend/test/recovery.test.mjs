// Actual PostgreSQL, truncated committed HTTP replies and SIGKILL/restart of Node.
// No calls to Lightsail. Google transport alone is a declared fixture.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import pg from 'pg';
import {migrate} from '../src/migrate.mjs';
test('lost replies and process restarts preserve one ride, one transition and online GPS intent',{timeout:90000},async t=>{
  assert.ok(process.env.DATABASE_URL,'Isolated PostgreSQL required');
  const admin=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const schema='recovery_'+randomUUID().replaceAll('-','');
  await admin.query('CREATE SCHEMA '+schema);
  const db=new pg.Pool({connectionString:process.env.DATABASE_URL,options:'-c search_path='+schema});
  await migrate(db);let child,base;
  t.after(async()=>{
    if(child&&child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill('SIGKILL');await ended;}
    await db.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();
  });
  async function start(){
    child=fork(new URL('./fixtures/recovery-server.mjs',import.meta.url),[],{env:{...process.env,RECOVERY_SCHEMA:schema},stdio:['ignore','ignore','ignore','ipc']});
    const ready=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error('Test API exited before ready');})]);
    assert.equal(ready[0].type,'ready');base='http://127.0.0.1:'+ready[0].port+'/v1';
  }
  async function restart(){const exited=once(child,'exit');child.kill('SIGKILL');await exited;await start();}
  async function call(path,token,body,status=200){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
    const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;
  }
  async function loseReply(path,token,body){
    const armed=once(child,'message');child.send({type:'arm',path:'/v1'+path});assert.equal((await armed)[0].type,'armed');
    await assert.rejects(()=>call(path,token,body));
  }
  await start();
  const register=(name,role,plate)=>call('/auth/register',null,{name,role,email:name+'@recovery.test',password:'recovery-password-fixture',inviteCode:'recovery-invite-fixture-only',
    ...(plate?{vehicle:{plate,model:'Isolated test',color:'Prata'}}:{})});
  const passenger=await register('passenger','passenger');
  const stranger=await register('stranger','passenger');
  const driver=await register('driver','driver','TST1A23');
  const loser=await register('other-driver','driver','TST2B34');
  for(const d of [driver,loser]){await call('/driver/location',d.token,{lat:-23.55,lng:-46.63});await call('/driver/availability',d.token,{available:true});}
  const origin={lat:-23.55,lng:-46.63,address:'Public test origin'},destination={lat:-23.56,lng:-46.64,address:'Public test destination'};
  const quote=await call('/quotes',passenger.token,{origin,destination});
  await loseReply('/rides',passenger.token,{quoteId:quote.id});await restart();
  const requests=await Promise.all(Array.from({length:8},()=>call('/rides',passenger.token,{quoteId:quote.id})));
  const id=requests[0].id;assert.ok(requests.every(r=>r.id===id));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM rides WHERE quote_id=$1',[quote.id])).rows[0].n,1);
  await loseReply('/rides/'+id+'/accept',driver.token,{});await restart();
  await call('/rides/'+id+'/accept',driver.token,{});
  await call('/rides/'+id+'/accept',loser.token,{},409);
  for(const [action,status] of [['arrive','arrived'],['start','in_progress'],['complete','completed']]){
    await loseReply('/rides/'+id+'/'+action,driver.token,{});
    const before=(await db.query('SELECT status,version FROM rides WHERE id=$1',[id])).rows[0];assert.equal(before.status,status);
    const events=(await db.query('SELECT count(*)::int AS n FROM events')).rows[0].n;
    await restart();
    const retries=await Promise.all(Array.from({length:4},()=>call('/rides/'+id+'/'+action,driver.token,{})));
    assert.ok(retries.every(r=>r.status===status));
    assert.deepEqual((await db.query('SELECT status,version FROM rides WHERE id=$1',[id])).rows[0],before);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM events')).rows[0].n,events,'Replay must not emit events');
    await call('/rides/'+id+'/'+action,stranger.token,{},403);
    await call('/rides/'+id+'/'+action,loser.token,{},403);
  }
  // An old command cannot move a completed trip back to an earlier state.
  await call('/rides/'+id+'/arrive',driver.token,{},409);
  await call('/rides/'+id+'/cancel',passenger.token,{},409);
  assert.equal((await call('/rides/'+id,passenger.token)).status,'completed');
  assert.equal((await call('/snapshot',passenger.token)).rides.length,0);
  const quote2=await call('/quotes',passenger.token,{origin,destination});
  const second=await call('/rides',passenger.token,{quoteId:quote2.id});
  await loseReply('/rides/'+second.id+'/cancel',passenger.token,{});await restart();
  const before=(await db.query('SELECT version FROM rides WHERE id=$1',[second.id])).rows[0].version;
  await call('/rides/'+second.id+'/cancel',passenger.token,{});
  assert.equal((await db.query('SELECT version FROM rides WHERE id=$1',[second.id])).rows[0].version,before);
  await call('/rides/'+second.id+'/cancel',stranger.token,{},403);
  await call('/rides/'+second.id+'/accept',driver.token,{},409);
  // GPS freshness controls dispatch eligibility, not the user's online intent.
  await db.query("UPDATE drivers SET location_at=now()-interval '2 minutes' WHERE user_id=$1",[driver.user.id]);
  const stale=await call('/snapshot',driver.token);assert.equal(stale.available,false);assert.equal(stale.online,true);
  await call('/driver/location',driver.token,{lat:-23.55,lng:-46.63});
  const recovered=await call('/snapshot',driver.token);assert.equal(recovered.available,true);assert.equal(recovered.online,true);
  await call('/driver/availability',driver.token,{available:false});
  const offline=await call('/snapshot',driver.token);assert.equal(offline.online,false);assert.equal(offline.available,false);
});
