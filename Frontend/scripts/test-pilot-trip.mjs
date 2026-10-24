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
    ['in.juspay.nammayatri.debug',true,'ANDROID','__failed',false],
    ['in.juspay.nammayatri.debug',true,'ANDROID','a'.repeat(64),true]]){
    globalThis.window={__OS:os,__YATRI_BR_DEVELOPMENT__:flag,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:pkg}),getFromSharedPrefs:()=>session}};
    assert.equal(ffi.enabled(),expected);
  }
  delete globalThis.window;
});
test('passenger can resume a stored trip without a new place selection, only with its own debug session',async()=>{
  const source=(await readFile(new URL('../ui-customer/src/Development/Rides.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
  const ffi=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const values={YATRI_PASSENGER_SESSION:'a'.repeat(64),YATRI_PASSENGER_ACTIVE_RIDE:'12345678-1234-4234-8234-123456789abc'};
  globalThis.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatri.debug'}),getFromSharedPrefs:key=>values[key]||''}};
  assert.equal(ffi.hasStoredRide(),true);
  values.YATRI_PASSENGER_ACTIVE_RIDE='';assert.equal(ffi.hasStoredRide(),false);
  values.YATRI_PASSENGER_ACTIVE_RIDE='12345678-1234-4234-8234-123456789abc';
  values.YATRI_PASSENGER_SESSION='__failed';assert.equal(ffi.hasStoredRide(),false);
  delete globalThis.window;
});

import {decodePolyline,mapPayload} from '../ui-common/src/Development/TripMap.mjs';
test('Google encoded geometry is decoded without substituting straight lines',()=>{
  const polyline='_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  assert.deepEqual(decodePolyline(polyline),[{lat:38.5,lng:-120.2},{lat:40.7,lng:-120.95},{lat:43.252,lng:-126.453}]);
  assert.throws(()=>decodePolyline('_'),/incompleta/);
  const payload=mapPayload({polyline},'123');
  assert.equal(payload.pureScriptID,'123');assert.equal(payload.routeConfigs[0].isActual,true);
});
test('stale driver GPS is explicitly marked instead of presented as live',()=>{
  const ride={fare_cents:500,driver_lat:-23.55,driver_lng:-46.63,driver_location_at:new Date(Date.now()-61000).toISOString()};
  assert.equal(tripView(ride).gpsFresh,false);assert.match(tripView(ride).tracking,/desatualizado/);
});
