// SPDX-License-Identifier: AGPL-3.0-or-later
import {callbackMapper} from 'presto-ui';
import {createOperationsClient} from '../../../ui-driver/src/Development/OperationsClient.mjs';
import {createNativeFetch} from '../../../ui-driver/src/Development/NativeTransport.mjs';
import {tripView} from '../../../ui-common/src/Development/PilotTrip.mjs';
let listener;
const rideKey='YATRI_PASSENGER_ACTIVE_RIDE';
export const enabled=()=>{
  try{return window.__OS==='ANDROID'&&window.__YATRI_BR_DEVELOPMENT__===true&&
    JSON.parse(window.JBridge.getDeviceInfo()).package_name==='in.juspay.nammayatri.debug'&&
    /^[a-f0-9]{64}$/.test(window.JBridge.getFromSharedPrefs('YATRI_PASSENGER_SESSION'));}catch(_){return false;}
};
export const hasStoredRide=()=>enabled()&&/^[a-f0-9-]{36}$/.test(window.JBridge.getFromSharedPrefs(rideKey)||'');
function client(){
  if(!enabled())throw Error('Conecte o passageiro ao servidor de testes.');
  return createOperationsClient({role:'passenger',baseUrl:window.JBridge.getFromSharedPrefs('YATRI_PASSENGER_BACKEND_URL'),
    token:window.JBridge.getFromSharedPrefs('YATRI_PASSENGER_SESSION'),
    fetchImpl:createNativeFetch(window.JBridge,callbackMapper.map,id=>{
      const registry=window.__PROXY_FN;if(registry instanceof Map)registry.delete(id);else if(registry)delete registry[id];
    })});
}
function diagnostics(owner){
  if(owner!==listener)return;
  // Read-only counters for Android acceptance; no session, URL, address or vehicle data.
  window.__YATRI_PASSENGER_POLL__={ticks:owner.ticks,reads:owner.reads,errors:owner.errors,
    polling:owner.polling,actionBusy:owner.busy,phase:owner.phase||'idle',lastSuccessAt:owner.lastSuccessAt||0};
}
function rememberRide(owner,id){
  if(owner!==listener)return;
  owner.rideId=id;window.JBridge.setInSharedPrefs(rideKey,id||'');
}
function emit(owner,value){
  if(owner!==listener)return;
  const serialized=JSON.stringify(value);
  if(serialized===owner.lastTrip)return;
  owner.changed(value)();
  owner.lastTrip=serialized;owner.phase=value.phase;
  window.__YATRI_PASSENGER_RIDE__={id:value.id,phase:value.phase};
  diagnostics(owner);
}
function fail(owner,error){
  if(owner!==listener)return;
  owner.errors++;
  owner.error(error.message||'Não foi possível atualizar a viagem.')();
  diagnostics(owner);
}
async function refresh(owner){
  const revision=++owner.revision;
  const current=()=>owner===listener&&revision===owner.revision;
  owner.reads++;diagnostics(owner);
  try{
    const api=client(),data=await api.snapshot();
    if(!current())return;
    if(data.rides.length){
      rememberRide(owner,data.rides[0].id);emit(owner,tripView(data.rides[0]));
    }else if(owner.rideId){
      const ride=await api.ride(owner.rideId);
      if(!current())return;
      emit(owner,tripView(ride));
    }else if(!owner.quote){
      // Retry an initial snapshot/quote failure on the next tick, without reopening.
      const quote=await api.quote(owner.origin,owner.destination);
      if(!current())return;
      owner.quote=quote;emit(owner,tripView(quote,'quoted'));
    }
    owner.lastSuccessAt=Date.now();diagnostics(owner);
  }catch(error){if(current())fail(owner,error);}
}
async function tick(owner){
  if(owner!==listener)return;
  owner.ticks++;
  if(owner.polling||owner.busy){diagnostics(owner);return;}
  owner.polling=true;diagnostics(owner);
  try{await refresh(owner);}finally{owner.polling=false;diagnostics(owner);}
}
export const subscribe=origin=>destination=>changed=>error=>()=>{
  if(listener)listener.stop();
  const saved=window.JBridge.getFromSharedPrefs(rideKey);
  const owner={origin,destination,changed,error,session:window.JBridge.getFromSharedPrefs('YATRI_PASSENGER_SESSION'),revision:0,ticks:0,reads:0,errors:0,busy:false,polling:false,
    rideId:/^[a-f0-9-]{36}$/.test(saved||'')?saved:null};
  listener=owner;
  const wake=()=>{Promise.resolve().then(()=>tick(owner));};
  const timer=setInterval(()=>tick(owner),3000);
  const resumed=window.onResumeListeners;
  if(Array.isArray(resumed))resumed.push(wake);
  if(window.addEventListener)window.addEventListener('online',wake);
  owner.stop=()=>{
    clearInterval(timer);owner.revision++;
    if(Array.isArray(resumed)){const index=resumed.indexOf(wake);if(index>=0)resumed.splice(index,1);}
    if(window.removeEventListener)window.removeEventListener('online',wake);
    if(listener===owner)listener=null;
  };
  tick(owner);
  return owner.stop;
};
export const request=()=>{
  const owner=listener;
  if(!owner||owner.busy||!owner.quote||owner.rideId)return;
  owner.busy=true;owner.revision++;diagnostics(owner);
  // Do not push a nested screen action from inside the request-click reducer.
  Promise.resolve().then(async()=>{
    try{
      if(owner!==listener)return;
      emit(owner,tripView(owner.quote,'requesting'));
      const created=await client().requestRide(owner.quote.id);
      if(owner!==listener){
        // A committed request may outlive its screen. Preserve only an empty
        // private receipt slot for the same session; never overwrite a newer ride.
        if(enabled()&&window.JBridge.getFromSharedPrefs('YATRI_PASSENGER_SESSION')===owner.session&&
            !window.JBridge.getFromSharedPrefs(rideKey))window.JBridge.setInSharedPrefs(rideKey,created.id);
        return;
      }
      rememberRide(owner,created.id);await refresh(owner);
    }catch(error){fail(owner,error);if(owner===listener&&!owner.rideId)emit(owner,tripView(owner.quote,'quoted'));}
    finally{owner.busy=false;diagnostics(owner);}
  });
};
export const dismiss=()=>{
  if(listener&&['completed','cancelled'].includes(listener.phase)){
    listener.revision++;rememberRide(listener,null);
  }
};
export const cancel=()=>{
  const owner=listener;
  if(!owner||owner.busy||!owner.rideId)return;
  owner.busy=true;owner.revision++;diagnostics(owner);
  Promise.resolve().then(async()=>{
    try{if(owner===listener){await client().rideAction(owner.rideId,'cancel');if(owner===listener)await refresh(owner);}}
    catch(error){fail(owner,error);}
    finally{owner.busy=false;diagnostics(owner);}
  });
};
