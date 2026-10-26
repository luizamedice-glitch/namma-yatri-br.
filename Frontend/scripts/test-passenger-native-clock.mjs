// SPDX-License-Identifier: AGPL-3.0-or-later
// Exercise the shipped SDK router and passenger callback entry in separate realms.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Android clock reaches the consumer iframe through the actual SDK callback router',async()=>{
  const root=new URL('../',import.meta.url);
  const boot=await readFile(new URL('android-native/app/src/user/nammaYatri/js/juspay/boot_loader.js',root),'utf8');
  const index=await readFile(new URL('ui-customer/index.js',root),'utf8');
  const java=await readFile(process.env.PASSENGER_NATIVE_BRIDGE_SOURCE||new URL('android-native/mobility-customer/src/main/java/in/juspay/mobility/customer/MobilityCustomerBridge.java',root),'utf8');
  const expression=java.match(/String script = ([\s\S]+?);\n\s+try \{/)[1];
  const sdkRouter=boot.slice(boot.indexOf('window.callUICallback=function'),boot.indexOf(',window.onBundleUpdate='));
  assert.ok(sdkRouter.length>100,'Original SDK routing entry must be present');
  const consumerCallback=index.slice(index.indexOf('window.callUICallback = function'),index.indexOf('window.onResumeListeners ='));
  const received=[],errors=[],callback='customer_42';
  const consumer={__PROXY_FN:{[callback]:(...args)=>received.push(args)}};
  vm.runInNewContext(consumerCallback,{window:consumer,isBrPassengerRuntime:true,console:{error:(...args)=>errors.push(args),warn:()=>{}}});
  const host={mapps:{customer:{contentWindow:consumer}},__BOOT_LOADER:{}};
  const realm=vm.createContext({window:host,console:{error:(...args)=>errors.push(args)}});
  vm.runInContext(sdkRouter,realm);
  // Java concatenation of string literals and the JSON-quoted opaque callback ID.
  const nativeScript=vm.runInNewContext(expression,{id:JSON.stringify(callback)});
  vm.runInContext(nativeScript,realm);
  assert.deepEqual(received,[['YATRI_PASSENGER_TICK']],
    'Scheduling on Android is insufficient: delivery must reach the registered consumer callback');
  assert.deepEqual(errors,[]);
  assert.equal(host.__YATRI_PASSENGER_CLOCK_CALLBACKS__,undefined,'No callback registry is copied into the SDK host');
});
