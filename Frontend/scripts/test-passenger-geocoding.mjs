// SPDX-License-Identifier: AGPL-3.0-or-later
// Native boundary fixtures; actual Android geocoder is validated separately in CI.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(run){
  let count=0;const callbacks={},results=[];let native;
  globalThis.geocodeMapper={map:fn=>{const id='geo'+(++count);callbacks[id]=fn;return id;}};
  globalThis.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,__PROXY_FN:callbacks,JBridge:{
    getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatri.debug'}),
    reverseGeocodeYatri:(lat,lng,id)=>{native={lat,lng,id,callback:callbacks[id]};return true;}}};
  const source=(await readFile(new URL('../ui-customer/src/Development/Geocoding.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
  const ffi=await import('data:text/javascript;base64,'+Buffer.from('const callbackMapper=globalThis.geocodeMapper;'+source).toString('base64')+'#'+Math.random());
  const stop=ffi.subscribe(lat=>lng=>address=>()=>results.push({lat,lng,address}))(_lat=>_lng=>()=>{})();
  try{await run({ffi,results,callbacks,native:()=>native,count:()=>count,stop});}
  finally{stop();delete globalThis.window;delete globalThis.geocodeMapper;}
}
test('native address resolves asynchronously, duplicate GPS shares pending request, cache avoids more calls',()=>harness(async h=>{
 h.ffi.resolve(-23.55)(-46.63)();h.ffi.resolve(-23.55)(-46.63)();assert.equal(h.count(),1);
 const n=h.native();n.callback('ok','Endereço de fixture');assert.equal(h.results.length,0);await flush();
 assert.equal(h.results[0].address,'Endereço de fixture');assert.equal(Object.keys(h.callbacks).length,0);
 h.ffi.resolve(-23.55)(-46.63)();await flush();assert.equal(h.count(),1);assert.equal(h.results.length,2);
 assert.equal(window.__YATRI_GEOCODING__.state,'resolved');
}));
test('old GPS result and closed subscriber cannot change the current origin',()=>harness(async h=>{
 h.ffi.resolve(-23.55)(-46.63)();const old=h.native();
 h.ffi.resolve(-23.56)(-46.64)();const next=h.native();
 old.callback('ok','Antigo');await flush();assert.equal(h.results.length,0);
 next.callback('ok','Novo');h.stop();await flush();assert.equal(h.results.length,0);
 assert.equal(Object.keys(h.callbacks).length,0);
}));
test('invalid coordinates, production and unavailable native geocoder do not invent an address',()=>harness(async h=>{
 h.ffi.resolve(0)(0)();h.ffi.resolve(NaN)(2)();assert.equal(h.count(),0);
 window.__YATRI_BR_DEVELOPMENT__=false;h.ffi.resolve(-23.55)(-46.63)();assert.equal(h.count(),0);
 window.__YATRI_BR_DEVELOPMENT__=true;window.JBridge.reverseGeocodeYatri=()=>false;
 h.ffi.resolve(-23.55)(-46.63)();await flush();assert.equal(h.results.length,0);
 assert.equal(window.__YATRI_GEOCODING__.state,'unavailable');assert.equal(Object.keys(h.callbacks).length,0);
}));
test('timeout releases callback and ignores a late native result',()=>harness(async h=>{
 const original=globalThis.setTimeout,clear=globalThis.clearTimeout;let expire;
 globalThis.setTimeout=fn=>{expire=fn;return 999;};globalThis.clearTimeout=()=>{};
 try{
  h.ffi.resolve(-23.55)(-46.63)();const n=h.native();expire();
  assert.equal(window.__YATRI_GEOCODING__.state,'unavailable');assert.equal(Object.keys(h.callbacks).length,0);
  n.callback('ok','Resposta tardia');await flush();assert.equal(h.results.length,0);
 }finally{globalThis.setTimeout=original;globalThis.clearTimeout=clear;}
}));
