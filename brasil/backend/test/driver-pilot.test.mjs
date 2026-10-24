import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDriverPilot,driverPilotId} from '../src/driver-pilot.mjs';
test('driver pilot rejects production, invalid windows and missing explicit enablement',()=>{
  for(const config of [{enabled:false},{nodeEnv:'production'},{until:'invalid'},{until:new Date(Date.now()+8*86400000).toISOString()}]){
    assert.throws(()=>createDriverPilot({enabled:true,nodeEnv:'development',until:new Date(Date.now()+3600000).toISOString(),...config}));
  }
});
test('pilot exposes only three authenticated operations and only the assigned driver',async t=>{
  let role='driver',id=driverPilotId,clock=Date.now(),queries=0;
  const pool={async query(sql){queries++;
    if(sql==='SELECT 1')return {rows:[{}]};
    return {rowCount:1,rows:[{id,role,name:'Giselo',expires_at:new Date(clock+3600000)}]};
  }};
  const server=createDriverPilot({pool,enabled:true,nodeEnv:'development',until:new Date(clock+3600000).toISOString(),now:()=>clock});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/health')).status,200);
  for(const [method,path] of [['POST','/v1/auth/register'],['POST','/v1/development/session'],['GET','/v1/events'],['POST','/v1/routes']]){
    const before=queries;assert.equal((await fetch(base+path,{method})).status,404);assert.equal(queries,before);
  }
  assert.equal((await fetch(base+'/v1/snapshot')).status,401);
  role='passenger';assert.equal((await fetch(base+'/v1/snapshot',{headers:{Authorization:'Bearer '+'a'.repeat(64)}})).status,403);
  role='driver';id='other';assert.equal((await fetch(base+'/v1/snapshot',{headers:{Authorization:'Bearer '+'a'.repeat(64)}})).status,403);
  clock+=3600001;assert.equal((await fetch(base+'/v1/snapshot',{headers:{Authorization:'Bearer '+'a'.repeat(64)}})).status,503);
});
