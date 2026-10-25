// SPDX-License-Identifier: AGPL-3.0-or-later
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../ui-customer/index.js',import.meta.url),'utf8');
const telemetry=source.slice(source.indexOf('const blackListFunctions'),source.indexOf('function guid()'));
const dispatcher=source.slice(source.indexOf('window.callUICallback = function'),source.indexOf('window.onResumeListeners ='));
test('BR native calls work when optional Firebase logging fails, including repeated bundle initialization',()=>{
  let native=0,logged=0;
  const bridge={getDeviceInfo:()=>{native++;return 'device';},firebaseLogEventWithParams:()=>{logged++;throw Error('Optional logging unavailable');}};
  const w={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,__YATRI_BR_PT_BR__:true,JBridge:bridge};
  const original=bridge.getDeviceInfo,context=vm.createContext({window:w,console});
  for(let i=0;i<2;i++){
    vm.runInContext('(function(){'+telemetry+'})()',context);
    assert.equal(bridge.getDeviceInfo(),'device');assert.equal(bridge.getDeviceInfo,original);
  }
  assert.equal(native,2);assert.equal(logged,0);
});
test('production retains original optional bridge telemetry',()=>{
  let logged=0;
  const w={__OS:'ANDROID',JBridge:{getDeviceInfo:()=> 'device',firebaseLogEventWithParams:()=>{logged++;}}};
  vm.runInNewContext('(function(){'+telemetry+'})()',{window:w,console});
  assert.equal(w.JBridge.getDeviceInfo(),'device');assert.equal(logged,1);
});
test('passenger callbacks survive object/Map registries and stale Map flags, including another JS realm',()=>{
  for(const type of ['object','map','foreign-map']){
    let calls=0;
    const registry=type==='object'?{}:type==='map'?new Map():vm.runInNewContext('new Map()');
    if(type==='object')registry.customer_7=()=>calls++;else registry.set('customer_7',()=>calls++);
    const w={__PROXY_FN:registry,__PROXY_FN_MAP_TYPE:type==='object',__THROTTELED_ACTIONS:[]};
    vm.runInNewContext(dispatcher,{window:w,console,isBrPassengerRuntime:true});
    w.callUICallback('customer_7','YATRI_PASSENGER_TICK');
    assert.equal(calls,1,type);
  }
});
