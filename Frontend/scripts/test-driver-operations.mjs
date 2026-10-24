import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createOperationsClient} from '../ui-driver/src/Development/OperationsClient.mjs';
import {createNativeFetch} from '../ui-driver/src/Development/NativeTransport.mjs';
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
  const raw=await readFile(new URL('../ui-driver/src/Development/Driver.js',import.meta.url),'utf8');
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
  const raw=await readFile(new URL('../ui-driver/src/Development/Driver.js',import.meta.url),'utf8');
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
test('original Firebase callback is skipped only for the explicit BR driver debug package',async()=>{
  const source=await readFile(new URL('../ui-common/src/Engineering/Helpers/JBridge.js',import.meta.url),'utf8');
  const start=source.indexOf('export const setFCMToken =');
  const end=source.indexOf('export const setFCMTokenWithTimeOut',start);
  const factory=new Function('window','callbackMapper',source.slice(start,end).replace('export const','const')+'\nreturn setFCMToken;');
  for(const [pkg,flag,expected] of [['in.juspay.nammayatripartner.debug',true,0],
    ['in.juspay.nammayatripartner',true,1],['in.juspay.nammayatri.debug',true,1],['in.juspay.nammayatripartner.debug',false,1]]){
    let calls=0;
    const bridge={getDeviceInfo:()=>JSON.stringify({package_name:pkg}),setFCMToken:()=>{calls++;}};
    factory({__YATRI_BR_DEVELOPMENT__:flag,JBridge:bridge},{map:f=>f})(()=>()=>{})(x=>x)();
    assert.equal(calls,expected);
  }
});
