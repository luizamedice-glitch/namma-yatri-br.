import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createOperationsClient} from '../ui-driver/src/Development/OperationsClient.mjs';
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
  const ffi=await import('data:text/javascript;base64,'+Buffer.from(raw.replace("import {createOperationsClient} from '../../src/Development/OperationsClient.mjs';",'const createOperationsClient=()=>{};')).toString('base64'));
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
  const ffi=await import('data:text/javascript;base64,'+Buffer.from(raw.replace("import {createOperationsClient} from '../../src/Development/OperationsClient.mjs';",'const createOperationsClient=()=>{};')).toString('base64'));
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
