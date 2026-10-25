// SPDX-License-Identifier: AGPL-3.0-or-later
// Explicit HTTP/SDK boundary fixtures; real Geoapify is checked in Android CI.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createGeocoding} from '../ui-customer/src/Development/GeocodingRuntime.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(run){
 const callbacks={},requests=[],results=[],positions=[];let counter=0;
 const prefs={YATRI_PASSENGER_SESSION:'a'.repeat(64),YATRI_PASSENGER_BACKEND_URL:'https://yatri.example.test'};
 const mapper={map:fn=>{const id='fixture'+(++counter);callbacks[id]=fn;return id;}};
 const bridge={getDeviceInfo:()=>'{"package_name":"in.juspay.nammayatri.debug"}',getFromSharedPrefs:key=>prefs[key]||'',
  reverseGeocodeYatri:()=>assert.fail('Geoapify must not call the Android geocoder'),
  callAPI:(method,url,body,headers,_a,_b,id)=>requests.push({method,url,body:JSON.parse(body),headers:JSON.parse(headers),id})};
 globalThis.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,__PROXY_FN:callbacks,JBridge:bridge};
 const api=createGeocoding(mapper),stop=api.subscribe(lat=>lng=>address=>()=>results.push({lat,lng,address}))(lat=>lng=>()=>positions.push({lat,lng}))();
 const reply=(status=200,address='Endereço de fixture')=>{
  const id=requests.at(-1).id;
  callbacks[id]('ok',JSON.stringify({address,location:{lat:-23.5501,lng:-46.6301},provider:'geoapify'}),status,'','',null);
 };
 try{await run({api,stop,bridge,prefs,callbacks,requests,results,positions,reply});}
 finally{stop();delete globalThis.window;}
}
test('GPS lookup uses authenticated Yatri endpoint, never exposes provider key and caches successful address',()=>harness(async h=>{
 h.api.resolve(-23.55)(-46.63)();h.api.resolve(-23.55)(-46.63)();assert.equal(h.requests.length,1);
 const r=h.requests[0];assert.equal(r.url,'https://yatri.example.test/v1/places/reverse');assert.equal(r.method,'POST');
 assert.equal(r.headers.Authorization,'Bearer '+'a'.repeat(64));assert.deepEqual(r.body,{location:{lat:-23.55,lng:-46.63}});
 assert.ok(!r.url.includes('apiKey'));h.reply();assert.equal(h.results.length,0);await flush();
 assert.equal(h.results[0].address,'Endereço de fixture');assert.equal(window.__YATRI_GEOCODING__.provider,'geoapify');
 h.api.resolve(-23.55)(-46.63)();await flush();assert.equal(h.requests.length,1);assert.equal(h.results.length,2);
}));
test('old GPS and closed screen cannot overwrite origin; SDK still handles late HTTP reply',()=>harness(async h=>{
 h.api.resolve(-23.55)(-46.63)();const old=h.requests[0];
 h.api.resolve(-23.56)(-46.64)();const next=h.requests[1];h.stop();await flush();
 for(const request of [old,next])assert.doesNotThrow(()=>h.callbacks[request.id]('ok','{}',200,'','',null));
 await flush();assert.equal(h.results.length,0);assert.equal(Object.keys(h.callbacks).length,0);
}));
test('invalid GPS, production mode and absent session never call the backend',()=>harness(async h=>{
 h.api.resolve(0)(0)();h.api.resolve(NaN)(2)();assert.equal(h.requests.length,0);
 window.__YATRI_BR_DEVELOPMENT__=false;h.api.resolve(-23.55)(-46.63)();assert.equal(h.requests.length,0);
 window.__YATRI_BR_DEVELOPMENT__=true;h.prefs.YATRI_PASSENGER_SESSION='';h.api.resolve(-23.55)(-46.63)();await flush();
 assert.equal(h.requests.length,0);assert.equal(h.results.length,0);
}));
test('rejects another project URL without sending passenger session',()=>harness(async h=>{
 h.prefs.YATRI_PASSENGER_BACKEND_URL='https://example.test/functions/v1/alce-mobilidade';
 h.api.resolve(-23.55)(-46.63)();await flush();assert.equal(h.requests.length,0);
}));
test('timeout leaves cleanup callback until native transport returns and never publishes late address',()=>harness(async h=>{
 const original=globalThis.setTimeout,clear=globalThis.clearTimeout;let expire;
 globalThis.setTimeout=(fn,ms)=>{if(ms===8000)expire=fn;return 999;};globalThis.clearTimeout=()=>{};
 try{
  h.api.resolve(-23.55)(-46.63)();expire();await flush();
  assert.equal(window.__YATRI_GEOCODING__.state,'unavailable');assert.equal(typeof h.callbacks[h.requests[0].id],'function');
  h.reply();await flush();assert.equal(h.results.length,0);assert.equal(Object.keys(h.callbacks).length,0);
 }finally{globalThis.setTimeout=original;globalThis.clearTimeout=clear;}
}));
test('recenter delivery is deferred and scoped to the active screen',()=>harness(async h=>{
 h.api.position('-23.55')('-46.63')();assert.equal(h.positions.length,0);await flush();assert.equal(h.positions.length,1);
 h.api.position('-23.56')('-46.64')();h.stop();await flush();assert.equal(h.positions.length,1);
}));
test('transient backend error retries on the same screen; authentication failure does not retry',()=>harness(async h=>{
 const original=globalThis.setTimeout,retries=[];
 globalThis.setTimeout=(fn,ms)=>ms===1500?(retries.push(fn),999):original(fn,ms);
 try{
  h.api.resolve(-23.55)(-46.63)();h.reply(502);await flush();assert.equal(retries.length,1);
  retries.shift()();h.reply();await flush();assert.equal(h.results.length,1);assert.equal(h.requests.length,2);
  h.api.resolve(-23.56)(-46.64)();h.reply(401);await flush();assert.equal(retries.length,0);
 }finally{globalThis.setTimeout=original;}
}));
test('persistent failure has a finite attempt budget and never invents an address',()=>harness(async h=>{
 const original=globalThis.setTimeout,retries=[];
 globalThis.setTimeout=(fn,ms)=>ms===1500?(retries.push(fn),999):original(fn,ms);
 try{
  h.api.resolve(-23.55)(-46.63)();
  for(let i=0;i<3;i++){h.reply(502);await flush();if(i<2){assert.equal(retries.length,1);retries.shift()();}}
  assert.equal(h.requests.length,3);assert.equal(retries.length,0);assert.equal(h.results.length,0);
 }finally{globalThis.setTimeout=original;}
}));
test('FFI runtime imports resolve both before and after PureScript copies foreign.js',async()=>{
 const sourceUrl=new URL('../ui-customer/src/Development/Geocoding.js',import.meta.url),outputUrl=new URL('../ui-customer/output/Development.Geocoding/foreign.js',import.meta.url);
 const source=await readFile(sourceUrl,'utf8');for(const match of source.matchAll(/from ['"](\.[^'"]+)['"]/g)){
  await access(new URL(match[1],sourceUrl));await access(new URL(match[1],outputUrl));
 }
});
