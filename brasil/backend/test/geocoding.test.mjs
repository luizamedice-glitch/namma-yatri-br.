// SPDX-License-Identifier: AGPL-3.0-or-later
// Provider contract fixtures; real Geoapify is validated separately.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {geoapifyGeocoding} from '../src/geocoding.mjs';
import {createApi} from '../src/http.mjs';
const point={lat:-23.55,lng:-46.63},key='fixture-key-only-not-a-real-secret';
const result={formatted:'Endereço de fixture, São Paulo, Brasil',lat:-23.5501,lon:-46.6301};
test('validates Geoapify query, returns actual provider fields and caches/coalesces requests',async()=>{
 let calls=0;const maps=geoapifyGeocoding({key,fetchImpl:async(url,options)=>{
  calls++;const u=new URL(url);assert.equal(u.hostname,'api.geoapify.com');assert.equal(u.searchParams.get('apiKey'),key);
  assert.equal(u.searchParams.get('lat'),String(point.lat));assert.equal(u.searchParams.get('lang'),'pt');assert.ok(options.signal);
  return {ok:true,json:async()=>({results:[result]})};
 }});
 const [a,b]=await Promise.all([maps.reverse(point),maps.reverse(point)]);assert.equal(calls,1);assert.deepEqual(a,b);
 assert.equal(a.address,result.formatted);assert.equal(a.provider,'geoapify');assert.equal(a.location.lng,result.lon);
 assert.match(a.attribution.data,/OpenStreetMap/);await maps.reverse(point);assert.equal(calls,1);
});
test('invalid positions and missing key cannot call the provider',async()=>{
 let called=false;const fetchImpl=async()=>{called=true;};
 await assert.rejects(()=>geoapifyGeocoding({key,fetchImpl}).reverse({lat:100,lng:2}),e=>e.status===400);
 await assert.rejects(()=>geoapifyGeocoding({fetchImpl}).reverse(point),e=>e.status===503);assert.equal(called,false);
});
test('provider error never leaks key/URL, failed result is not cached and daily budget is enforced',async()=>{
 let calls=0;const maps=geoapifyGeocoding({key,dailyLimit:2,fetchImpl:async()=>{calls++;throw Error('URL with key '+key);}});
 for(let i=0;i<2;i++)await assert.rejects(()=>maps.reverse(point),e=>e.status===502&&!e.message.includes(key));
 await assert.rejects(()=>maps.reverse(point),e=>e.status===429);assert.equal(calls,2);
 for(const results of [[],[{...result,formatted:''}],[{...result,lat:NaN}]]){
  const service=geoapifyGeocoding({key,fetchImpl:async()=>({ok:true,json:async()=>({results})})});
  await assert.rejects(()=>service.reverse(point));
 }
});
test('reverse endpoint authorizes before provider query',async()=>{
 let calls=0;const server=createApi({pool:{},service:{authenticate:async token=>{if(token!=='fixture-session'){const e=Error('Acesso negado');e.status=401;throw e;}return {role:'passenger'};}},maps:{reverse:async p=>{calls++;assert.deepEqual(p,point);return {address:result.formatted,provider:'geoapify'};}}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const options={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({location:point})};
  assert.equal((await fetch(base+'/v1/places/reverse',options)).status,401);assert.equal(calls,0);
  const response=await fetch(base+'/v1/places/reverse',{...options,headers:{...options.headers,Authorization:'Bearer fixture-session'}});
  assert.equal(response.status,200);assert.equal((await response.json()).provider,'geoapify');assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
