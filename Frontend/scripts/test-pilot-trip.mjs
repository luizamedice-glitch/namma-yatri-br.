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
  const ride={status:'accepted',fare_cents:500,driver_lat:-23.55,driver_lng:-46.63,driver_location_at:new Date(Date.now()-61000).toISOString()};
  assert.equal(tripView(ride).gpsFresh,false);assert.match(tripView(ride).tracking,/desatualizado/);
  assert.equal(tripView({...ride,status:'completed'}).tracking,'');
});
test('trip map uses the existing native bridge and updates the assigned GPS marker',async()=>{
  let ready;const calls=[];
  globalThis.tripMapTest={mapPayload};
  const source=(await readFile(new URL('../ui-common/src/Development/TripMapRuntime.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
  const runtime=await import('data:text/javascript;base64,'+Buffer.from('const {mapPayload}=globalThis.tripMapTest;'+source).toString('base64'));
  globalThis.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatri.debug'}),
    showMap:()=>calls.push('mount'),removeAllPolylines:()=>calls.push('clear'),drawRouteV2:data=>calls.push(JSON.parse(data)),showMarker:data=>calls.push(JSON.parse(data)),removeMarker:id=>calls.push('remove:'+id)},__PROXY_FN:{}};
  runtime.updateTripMap({polyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@',gpsFresh:true,driverLat:-23.55,driverLng:-46.63,phase:'accepted'});
  runtime.mountMapWithMapper('123',callback=>{ready=callback;return 'cb';});
  ready('MAP');
  assert.equal(calls[0],'mount');assert.equal(calls[2].routeConfigs[0].locations.points.length,3);
  assert.equal(calls.find(x=>x?.markerConfig?.markerId==='br-live-driver').lat,'-23.55');
  assert.equal(JSON.parse(calls[2].routeConfigs[0].startMarkerConfig).pointerIcon,'');
  assert.ok(calls[1]==='clear');
  runtime.updateTripMap({polyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@',gpsFresh:false,driverLat:0,driverLng:0,phase:'accepted'});
  assert.equal(calls.at(-1),'remove:br-live-driver');assert.equal(window.__YATRI_TRIP_MAP__.gpsFresh,false);
  runtime.releaseTripMap();assert.equal(window.__YATRI_TRIP_MAP__.ready,false);
  const length=calls.length;window.__YATRI_BR_DEVELOPMENT__=false;runtime.mountMapWithMapper('456',()=>{});
  assert.equal(calls.length,length);
  delete globalThis.window;delete globalThis.tripMapTest;
});
test('camera fits Google geometry plus live vehicle and does not refit an unchanged position',async()=>{
  const source=(await readFile(new URL('../ui-common/src/Development/TripMapRuntime.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
  globalThis.tripMapCameraTest={mapPayload};
  const runtime=await import('data:text/javascript;base64,'+Buffer.from('const {mapPayload}=globalThis.tripMapCameraTest;'+source).toString('base64')+'#camera');
  const cameras=[],clears=[];let ready;
  globalThis.window={devicePixelRatio:3,__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatri.debug'}),
    showMap:()=>{},removeAllPolylines:value=>clears.push(JSON.parse(value)),drawRouteV2:()=>{},showMarker:()=>{},removeMarker:()=>{},
    getLayoutBounds:()=>JSON.stringify({width:320,height:240}),animateCamera:(...args)=>cameras.push(args)},__PROXY_FN:{}};
  const trip={polyline:'_p~iF~ps|UgEfEgEfE',gpsFresh:true,driverLat:38.505,driverLng:-120.205,phase:'accepted'};
  try{
    runtime.updateTripMap(trip);runtime.mountMapWithMapper('123',callback=>{ready=callback;return 'cb';});ready('MAP');
    await new Promise(resolve=>setTimeout(resolve,200));
    assert.equal(cameras.length,1);assert.ok(Math.abs(cameras[0][0]-38.5025)<0.0001);assert.ok(Math.abs(cameras[0][1]+120.2025)<0.0001);
    assert.ok(cameras[0][2]>13&&cameras[0][2]<=18);assert.ok(clears[0].markersToRemove.includes('ny_ic_source_dot'));
    assert.ok(clears[0].markersToRemove.includes('ny_ic_dest_marker'));
    runtime.updateTripMap({...trip});await new Promise(resolve=>setTimeout(resolve,200));assert.equal(cameras.length,1);
    runtime.updateTripMap({...trip,driverLat:38.506});await new Promise(resolve=>setTimeout(resolve,200));assert.equal(cameras.length,1,'GPS updates must not keep overriding a manually panned camera');
  }finally{runtime.releaseTripMap();delete globalThis.window;delete globalThis.tripMapCameraTest;}
});

test('passenger route uses controlled markers while driver keeps original route contract',()=>{
  const trip={polyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'};
  const passenger=mapPayload(trip,'map',true).routeConfigs[0],driver=mapPayload(trip,'map').routeConfigs[0];
  assert.equal(passenger.routeKey,'BR_PASSENGER_ROUTE');assert.equal(passenger.routeColor,'#E6007E');
  assert.equal(JSON.parse(passenger.endMarkerConfig).pointerIcon,'');
  assert.equal(driver.routeKey,'DEFAULT');assert.equal(JSON.parse(driver.startMarkerConfig).pointerIcon,'ny_ic_source_dot');
  assert.equal(driver.routeColor,'#743454');
});
