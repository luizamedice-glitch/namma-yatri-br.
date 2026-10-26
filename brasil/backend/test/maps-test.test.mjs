// Fixtures test isolation only; real Google acceptance is recorded separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createMapsTestServer} from '../maps-test-server.mjs';
const initial = Date.parse('2026-10-23T12:00:00Z');
const until = new Date(initial + 3600000).toISOString();
const maps = {autocomplete:async () => ({suggestions:[{placeId:'fixture', address:'Fixture'}]}),
  details:async () => ({placeId:'fixture', location:{lat:-23,lng:-46}}), route:async () => ({distanceMeters:100})};
test('motor anônimo recusa produção, flag ausente e janela expirada ou longa', () => {
  const config = {maps, enabled:true, until, now:() => initial};
  for (const options of [{production:true},{enabled:false},{until:'invalid'},
    {until:new Date(initial).toISOString()}, {until:new Date(initial + 8*86400000).toISOString()}]) {
    assert.throws(() => createMapsTestServer({...config,...options}));
  }
});
test('sem sessão: somente três operações de mapas; autenticação/corridas/GPS não existem', async t => {
  let time = initial;
  const server=createMapsTestServer({maps,enabled:true,until,now:() => time});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(() => new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;
  const post = path => fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  for (const path of ['/v1/test/places/autocomplete','/v1/test/places/details','/v1/test/routes']) {
    const response=await post(path);assert.equal(response.status,200);assert.equal(response.headers.get('x-yatri-test-mode'),'maps-only');
  }
  for (const path of ['/v1/rides','/v1/auth/register','/v1/development/session','/v1/driver/location','/v1/test/rides']) {
    assert.equal((await post(path)).status,404);
  }
  assert.equal((await fetch(base+'/v1/test/places/autocomplete')).status,404);
  time+=3600001;assert.equal((await post('/v1/test/routes')).status,503);
});
test('limites compartilhados impedem novas chamadas Google e corpo inválido é recusado',async t=>{
  let calls=0,time=initial;
  const server=createMapsTestServer({maps:{...maps,route:async()=>{calls++;return {};}},enabled:true,until,
    now:()=>time,minuteLimit:2,dailyLimit:3});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;
  const post=body=>fetch(base+'/v1/test/routes',{method:'POST',body});
  assert.equal((await post('{')).status,400);
  assert.equal((await post('{}')).status,200);
  assert.equal((await post('{}')).status,429);assert.equal(calls,1);
  time+=60000;assert.equal((await post('{}')).status,200);
  assert.equal((await post('{}')).status,429);assert.equal(calls,2);
});
