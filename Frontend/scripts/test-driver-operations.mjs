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
