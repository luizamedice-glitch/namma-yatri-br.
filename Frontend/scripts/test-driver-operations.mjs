import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createOperationsClient} from '../ui-driver/src/Development/OperationsClient.mjs';
import {createNativeFetch} from '../ui-driver/src/Development/NativeTransport.mjs';
import {tripView} from '../ui-common/src/Development/PilotTrip.mjs';
test('online requires notification permission; native tracking owns GPS and survives screen cleanup',async()=>{
  let ready=false,active=false,available=false,gpsCalls=0,availabilityCalls=0;const wanted=[],errors=[];
  const api={snapshot:async()=>({available,rides:[],offers:[]}),location:async()=>{gpsCalls++;},availability:async value=>{availabilityCalls++;available=value;return {available};}};
  globalThis.driverBackgroundHarness={createOperationsClient:()=>api,createNativeFetch:()=>{},callbackMapper:{},tripView,updateTripMap:()=>{},releaseTripMap:()=>{}};
  globalThis.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatripartner.debug'}),
    getFromSharedPrefs:()=>'',prepareYatriDriverTracking:()=>ready,isYatriDriverTrackingActive:()=>active,setYatriDriverTracking:value=>wanted.push(value)}};
  const source=(await readFile(new URL('../ui-driver/src/Development/Driver.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
  const ffi=await import('data:text/javascript;base64,'+Buffer.from('const {createOperationsClient,createNativeFetch,callbackMapper,tripView,updateTripMap,releaseTripMap}=globalThis.driverBackgroundHarness;'+source).toString('base64'));
  const flush=()=>new Promise(resolve=>setImmediate(resolve));let stop;
  try{
    stop=ffi.subscribe(()=>()=>{})(message=>()=>errors.push(message))(()=>{})(()=>()=>{})();await flush();
    ffi.location(-23.55)(-46.63)();await flush();assert.equal(gpsCalls,1);
    ffi.availability(true)(()=>()=>{})(()=>()=>{})();await flush();
    assert.equal(availabilityCalls,0,'Permission refusal must not mark the driver online');assert.match(errors.at(-1),/Autorize/);
    ready=true;ffi.availability(true)(()=>()=>{})(()=>()=>{})();await flush();assert.equal(wanted.at(-1),true);
    active=true;const before=gpsCalls;ffi.location(-23.56)(-46.64)();await flush();assert.equal(gpsCalls,before,'Native GPS must not be duplicated by WebView');
    const commands=wanted.length;stop();stop=null;assert.equal(wanted.length,commands,'Screen cleanup must not stop online tracking');
    ffi.availability(false)(()=>()=>{})(()=>()=>{})();await flush();assert.equal(wanted.at(-1),false);
    window.JBridge.supportsYatriDriverTracking=()=>false;ready=false;active=false;
    const previous=availabilityCalls;ffi.availability(true)(()=>()=>{})(()=>()=>{})();await flush();
    assert.equal(availabilityCalls,previous+1,'Legacy debug variant must retain original foreground operation when native pilot is disabled');
  }finally{if(stop)stop();delete globalThis.window;delete globalThis.driverBackgroundHarness;}
});
test('driver discards stale snapshots and retains the persisted completed trip until dismissed',async()=>{
  const id='12345678-1234-4234-8234-123456789abc';
  const ride={id,status:'accepted',fare_cents:1234,route:{distanceMeters:1000},origin:{address:'Embarque do teste'},destination:{address:'Destino do teste'}};
  let current=()=>({available:true,rides:ride.status==='completed'?[]:[{...ride}],offers:[]}),poll,resolveOld,slow=false;
  const prefs={},phases=[],errors=[];
  const api={snapshot:()=>slow?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(current()),
    navigation:async()=>({route:ride.route,leg:'pickup'}),ride:async()=>({...ride}),rideAction:async(_id,action)=>{ride.status={arrive:'arrived',start:'in_progress',complete:'completed'}[action];}};
  globalThis.driverStateHarness={createOperationsClient:()=>api,createNativeFetch:()=>{},callbackMapper:{},tripView,updateTripMap:()=>{},releaseTripMap:()=>{}};
  globalThis.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatripartner.debug'}),
    getFromSharedPrefs:key=>prefs[key]||'',setInSharedPrefs:(key,value)=>{prefs[key]=value;}}};
  const interval=globalThis.setInterval,clear=globalThis.clearInterval;
  globalThis.setInterval=fn=>{poll=fn;return 1;};globalThis.clearInterval=()=>{};
  const source=(await readFile(new URL('../ui-driver/src/Development/Driver.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
  const url='data:text/javascript;base64,'+Buffer.from('const {createOperationsClient,createNativeFetch,callbackMapper,tripView,updateTripMap,releaseTripMap}=globalThis.driverStateHarness;'+source).toString('base64');
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  let cleanup;
  try{
    let ffi=await import(url);
    const subscribe=module=>module.subscribe(()=>()=>{})(error=>()=>errors.push(error))(()=>{})(trip=>()=>phases.push(trip.phase))();
    cleanup=subscribe(ffi);await tick();assert.equal(phases.at(-1),'accepted');
    slow=true;const older=poll();slow=false;
    ffi.act('arrive')(id)();await tick();assert.equal(phases.at(-1),'arrived');
    resolveOld({available:true,rides:[{...ride,status:'accepted'}],offers:[]});await older;
    assert.equal(phases.at(-1),'arrived','Older HTTP result must not roll back the confirmed state');
    ffi.act('start')(id)();await tick();assert.equal(phases.at(-1),'in_progress');
    ffi.act('complete')(id)();await tick();assert.equal(phases.at(-1),'completed');
    assert.equal(prefs.YATRI_DRIVER_ACTIVE_RIDE,id);
    cleanup();ffi=await import(url+'#recreated');cleanup=subscribe(ffi);await tick();
    assert.equal(phases.at(-1),'completed');
    const beforeDismiss=phases.length;ffi.dismissTrip();
    assert.equal(phases.length,beforeDismiss,'A click must not emit a reentrant screen event before its own state is committed');
    await tick();assert.equal(phases.at(-1),'idle');assert.equal(prefs.YATRI_DRIVER_ACTIVE_RIDE,'');
    assert.deepEqual(errors,[]);
  }finally{
    if(cleanup)cleanup();globalThis.setInterval=interval;globalThis.clearInterval=clear;
    delete globalThis.window;delete globalThis.driverStateHarness;
  }
});
test('native HTTP transport preserves request and handles real bridge response formats, errors and late cancellation',async()=>{
  let callback,request,removed=[];
  const bridge={callAPI:(...args)=>{request=args;}};
  const transport=createNativeFetch(bridge,fn=>{callback=fn;return 'callback-test';},id=>removed.push(id));
  const pending=transport('http://127.0.0.1:8080/v1/snapshot',{method:'GET',headers:{Authorization:'Bearer fixture-only'}});
  assert.equal(request[0],'GET');assert.equal(JSON.parse(request[3]).Authorization,'Bearer fixture-only');
  callback('success',JSON.stringify({available:false}),'200');
  assert.deepEqual(await (await pending).json(),{available:false});assert.deepEqual(removed,['callback-test']);
  const encoded=transport('http://127.0.0.1:8080/v1/driver/availability',{method:'POST',body:'{"available":true}'});
  assert.equal(request[2],'{"available":true}');
  callback('success','unused','200','','',encodeURIComponent(JSON.stringify({available:true})));
  assert.deepEqual(await (await encoded).json(),{available:true});
  const rejected=transport('http://127.0.0.1:8080/v1/snapshot');callback('failure','{}','401');
  assert.equal((await rejected).ok,false);
  const controller=new AbortController();
  const delayed=transport('http://127.0.0.1:8080/v1/snapshot',{signal:controller.signal});
  controller.abort();await assert.rejects(delayed,/não respondeu/);
  assert.doesNotThrow(()=>callback('success','{}','200'));
  const malformed=transport('http://127.0.0.1:8080/v1/snapshot');callback('success','not-json','200');
  await assert.rejects((await malformed).json(),/Resposta inválida/);
});
test('local optional configuration uses explicit defaults only in the driver test variant',async()=>{
  const source=await readFile(new URL('../ui-driver/src/Development/LocalRemoteConfig.js',import.meta.url),'utf8');
  const raw=source.replace("import * as original from '../../output/Common.RemoteConfig.Utils/foreign.js?br-driver-original-config';",'const original={fetchRemoteConfigString:key=>"original:"+key,isWhiteListed:()=>false};')
    .replace("import dashboardDefaults from './DashboardDefaults.json';",'const dashboardDefaults='+await readFile(new URL('../ui-driver/src/Development/DashboardDefaults.json',import.meta.url),'utf8')+';')
    .replace("import {enabled} from './Driver.js';",'const enabled=()=>globalThis.driverConfigTestEnabled;');
  const adapter=await import('data:text/javascript;base64,'+Buffer.from(raw).toString('base64'));
  globalThis.driverConfigTestEnabled=true;
  const perf=JSON.parse(adapter.fetchRemoteConfigString('perf_config'));
  assert.equal(perf.default.mapRecenter,true);
  assert.equal(JSON.parse(adapter.fetchRemoteConfigString('events_config')).enabled,false);
  assert.equal(JSON.parse(adapter.fetchRemoteConfigString('enable_otp_ride_config')).default.enableOtpRide,false);
  assert.equal(JSON.parse(adapter.fetchRemoteConfigString('pet_rides_feature_config')).default.enablePetRidesFeature,false);
  assert.equal(JSON.parse(adapter.fetchRemoteConfigString('ride_assigned_audio')).default.oneWay,null);
  assert.equal(adapter.fetchRemoteConfigString('other'),'original:other');
  globalThis.driverConfigTestEnabled=false;
  assert.equal(adapter.fetchRemoteConfigString('perf_config'),'original:perf_config');
  delete globalThis.driverConfigTestEnabled;
});
test('reject configuration, invalid coordinates, forbidden actions before issuing requests', () => {
  assert.throws(() => createOperationsClient({baseUrl:'',token:''}));
  let calls=0;
  const api=createOperationsClient({baseUrl:'https://test.invalid',token:'a'.repeat(64),fetchImpl:()=>{calls++;}});
  assert.throws(()=>api.location(NaN,0));
  assert.throws(()=>api.location(-91,0));
  assert.throws(()=>api.rideAction('../../other','accept'));
  assert.equal(calls,0);
});
test('runtime gate fails closed for production, passenger, missing native bridge and web', async () => {
  const raw=(await readFile(new URL('../ui-driver/src/Development/Driver.js',import.meta.url),'utf8')).replace(/^import \{updateTripMap,releaseTripMap\}.*;$/m,'const updateTripMap=()=>{},releaseTripMap=()=>{};').replace("import {tripView} from '../../../ui-common/src/Development/PilotTrip.mjs';",'const tripView=x=>x;');
  const ffi=await import('data:text/javascript;base64,'+Buffer.from(raw.replace("import {createOperationsClient} from '../../src/Development/OperationsClient.mjs';",'const createOperationsClient=()=>{};').replace("import {createNativeFetch} from '../../src/Development/NativeTransport.mjs';",'const createNativeFetch=()=>{};').replace("import {callbackMapper} from \'presto-ui\';",'const callbackMapper={map:x=>x};')).toString('base64'));
  for(const [name,flag,os,expected] of [
    ['in.juspay.nammayatripartner',true,'ANDROID',false],
    ['in.juspay.nammayatri.debug',true,'ANDROID',false],
    ['in.juspay.nammayatripartner.debug',false,'ANDROID',false],
    ['in.juspay.nammayatripartner.debug',true,'WEB',false],
    ['in.juspay.nammayatripartner.debug',true,'ANDROID',true]]){
    globalThis.window={__OS:os,__YATRI_BR_DEVELOPMENT__:flag,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:name})}};
    assert.equal(ffi.enabled(),expected);
  }
  delete globalThis.window.JBridge;
  assert.equal(ffi.enabled(),false);
});
test('resynchronize stale callback registry type after original Core2 imports, preserving SDK callbacks',async()=>{
  const raw=(await readFile(new URL('../ui-driver/src/Development/Driver.js',import.meta.url),'utf8')).replace(/^import \{updateTripMap,releaseTripMap\}.*;$/m,'const updateTripMap=()=>{},releaseTripMap=()=>{};').replace("import {tripView} from '../../../ui-common/src/Development/PilotTrip.mjs';",'const tripView=x=>x;');
  const ffi=await import('data:text/javascript;base64,'+Buffer.from(raw.replace("import {createOperationsClient} from '../../src/Development/OperationsClient.mjs';",'const createOperationsClient=()=>{};').replace("import {createNativeFetch} from '../../src/Development/NativeTransport.mjs';",'const createNativeFetch=()=>{};').replace("import {callbackMapper} from \'presto-ui\';",'const callbackMapper={map:x=>x};')).toString('base64'));
  const callback=()=>42;
  for(const registry of [{existing:callback},new Map([['existing',callback]])]){
    globalThis.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatripartner.debug'})},__PROXY_FN:registry,__PROXY_FN_MAP_TYPE:!(registry instanceof Map)};
    ffi.prepareRuntime();
    assert.equal(window.__PROXY_FN,registry);
    const fn=window.__PROXY_FN_MAP_TYPE?registry.get('existing'):registry.existing;
    assert.equal(fn(),42);
    assert.equal(window.__PROXY_FN_MAP_TYPE,registry instanceof Map);
  }
});
test('driver-only bridge adapter preserves the original Firebase call outside the explicit gate',async()=>{
  let source=await readFile(new URL('../ui-driver/src/Development/LocalJBridge.js',import.meta.url),'utf8');
  source=source.replace(/^export \* from .*;$/gm,'').replace(/^import .*;$/gm,'');
  const factory=new Function('enabled','originalSetFCMToken',source.replace('export const','const')+';return setFCMToken;');
  for(const enabled of [true,false]){
    let calls=0;
    factory(()=>enabled,cb=>action=>()=>{calls++;})(()=>()=>{})(x=>x)();
    assert.equal(calls,enabled?0:1);
  }
});
