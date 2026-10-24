// SPDX-License-Identifier: AGPL-3.0-or-later
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {tripView} from '../ui-common/src/Development/PilotTrip.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(run){
  const id='12345678-1234-4234-8234-123456789abc';
  const ride={id,status:'searching',fare_cents:1234,origin:{address:'Origem do contrato'},destination:{address:'Destino do contrato'},route:{distanceMeters:1000}};
  const quote={id:'quote',fareCents:1234,origin:ride.origin,destination:ride.destination,route:ride.route};
  const prefs={YATRI_PASSENGER_SESSION:'a'.repeat(64)};
  let poll,active=false,offline=false,reads=0;
  const phases=[],errors=[];
  const api={snapshot:async()=>{reads++;if(offline)throw Error('Conexão interrompida');return {rides:active&&!['cancelled','completed'].includes(ride.status)?[{...ride}]:[]};},
    ride:async()=>({...ride}),quote:async()=>({...quote}),requestRide:async()=>{active=true;return {id};},rideAction:async()=>{ride.status='cancelled';}};
  globalThis.passengerHarness={createOperationsClient:()=>api,createNativeFetch:()=>{},callbackMapper:{map:x=>x},tripView};
  const events=new Map();
  globalThis.window={onResumeListeners:[],addEventListener:(name,callback)=>events.set(name,callback),removeEventListener:(name,callback)=>{if(events.get(name)===callback)events.delete(name);},__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:'in.juspay.nammayatri.debug'}),
    getFromSharedPrefs:key=>prefs[key]||'',setInSharedPrefs:(key,value)=>{prefs[key]=value;}}};
  const interval=globalThis.setInterval,clear=globalThis.clearInterval;
  globalThis.setInterval=fn=>{poll=fn;return 1;};globalThis.clearInterval=()=>{};
  const source=(await readFile(new URL('../ui-customer/src/Development/Rides.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
  const ffi=await import('data:text/javascript;base64,'+Buffer.from('const {createOperationsClient,createNativeFetch,callbackMapper,tripView}=globalThis.passengerHarness;'+source).toString('base64')+'#'+Math.random());
  const subscribe=()=>ffi.subscribe({})({})(trip=>()=>phases.push(trip.phase))(e=>()=>errors.push(e))();
  let cleanup=subscribe();
  try{await tick();await run({ffi,api,ride,prefs,phases,errors,poll:()=>poll(),subscribe:()=>{cleanup();cleanup=subscribe();},offline:v=>{offline=v;},reads:()=>reads,events});}
  finally{cleanup();assert.equal(window.onResumeListeners.length,0);assert.equal(events.size,0);globalThis.setInterval=interval;globalThis.clearInterval=clear;delete globalThis.window;delete globalThis.passengerHarness;}
}
test('passenger polling follows every backend state without resubscribe, including completion and reconnection',()=>harness(async h=>{
  assert.equal(h.phases.at(-1),'quoted');h.ffi.request();await tick();assert.equal(h.phases.at(-1),'searching');
  for(const phase of ['accepted','arrived','in_progress','completed']){
    if(phase==='arrived'){
      h.offline(true);await h.poll();assert.equal(h.phases.at(-1),'accepted');assert.match(h.errors.at(-1),/interrompida/);h.offline(false);
    }
    h.ride.status=phase;await h.poll();assert.equal(h.phases.at(-1),phase);
  }
  assert.equal(h.prefs.YATRI_PASSENGER_ACTIVE_RIDE,h.ride.id);
  h.subscribe();await tick();assert.equal(h.phases.at(-1),'completed');
}));
test('request click does not dispatch a synchronous reentrant event into PrestoDOM',()=>harness(async h=>{
  const count=h.phases.length;h.ffi.request();
  assert.equal(h.phases.length,count,'The click reducer must commit before receiving another action');
  await tick();assert.equal(h.phases.at(-1),'searching');
}));
test('a snapshot started before cancellation cannot restore the searching screen',()=>harness(async h=>{
  h.ffi.request();await tick();
  let resolve;
  h.api.snapshot=()=>new Promise(r=>{resolve=r;});
  const pending=h.poll();
  h.api.snapshot=async()=>({rides:[]});
  h.ffi.cancel();await tick();assert.equal(h.phases.at(-1),'cancelled');
  resolve({rides:[{...h.ride,status:'searching'}]});await pending;
  assert.equal(h.phases.at(-1),'cancelled');
}));
test('failed initial quote is retried after connectivity returns without recreating the screen',()=>harness(async h=>{
  h.api.quote=async()=>{throw Error('Conexão interrompida');};
  h.subscribe();await tick();assert.match(h.errors.at(-1),/interrompida/);
  const before=h.phases.length;
  h.api.quote=async()=>({id:'new-quote',fareCents:1000,origin:h.ride.origin,destination:h.ride.destination,route:h.ride.route});
  await h.poll();assert.ok(h.phases.length>before,'Recovered quote must reach the existing listener');assert.equal(h.phases.at(-1),'quoted');
}));

test('unchanged snapshots do not rerender and online/resume refresh immediately with one listener',()=>harness(async h=>{
  h.ffi.request();await tick();const count=h.phases.length;
  await h.poll();assert.equal(h.phases.length,count);
  h.offline(true);await h.poll();h.offline(false);h.ride.status='accepted';
  assert.equal(window.onResumeListeners.length,1);
  window.onResumeListeners[0]();await tick();assert.equal(h.phases.at(-1),'accepted');
  h.ride.status='arrived';h.events.get('online')();await tick();assert.equal(h.phases.at(-1),'arrived');
  h.subscribe();await tick();assert.equal(window.onResumeListeners.length,1);assert.equal(h.events.size,1);
}));
