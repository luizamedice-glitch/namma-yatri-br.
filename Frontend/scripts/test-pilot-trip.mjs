import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tripView} from '../ui-common/src/Development/PilotTrip.mjs';
import {readFile} from 'node:fs/promises';
test('trip presentation preserves server amount, actual addresses and assignment',()=>{
  const result=tripView({id:'trip',status:'accepted',origin:{address:'Praça da Sé'},destination:{address:'Av. Paulista'},
    fare_cents:1234,route:{distanceMeters:4250},passenger_name:'Fagner',driver_name:'Giselo',model:'Modelo de teste',color:'Prata',plate:'TST1A23'});
  assert.match(result.fare,/12,34/);assert.equal(result.origin,'Praça da Sé');assert.equal(result.driver,'Giselo');
  assert.equal(result.phase,'accepted');assert.match(result.distance,/4,3/);
  assert.throws(()=>tripView({fareCents:NaN}),/inválido/);
});
test('passenger operations stay disabled outside the configured BR passenger debug context',async()=>{
  let source=await readFile(new URL('../ui-customer/src/Development/Rides.js',import.meta.url),'utf8');
  source=source.replace(/^import .*;$/gm,'');
  const ffi=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  for(const [pkg,flag,os,session,expected] of [
    ['in.juspay.nammayatri',true,'ANDROID','x',false],
    ['in.juspay.nammayatripartner.debug',true,'ANDROID','x',false],
    ['in.juspay.nammayatri.debug',false,'ANDROID','x',false],
    ['in.juspay.nammayatri.debug',true,'WEB','x',false],
    ['in.juspay.nammayatri.debug',true,'ANDROID','',false],
    ['in.juspay.nammayatri.debug',true,'ANDROID','a'.repeat(64),true]]){
    globalThis.window={__OS:os,__YATRI_BR_DEVELOPMENT__:flag,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:pkg}),getFromSharedPrefs:()=>session}};
    assert.equal(ffi.enabled(),expected);
  }
  delete globalThis.window;
});
