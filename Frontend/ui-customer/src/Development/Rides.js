// SPDX-License-Identifier: AGPL-3.0-or-later
import {callbackMapper} from 'presto-ui';
import {createOperationsClient} from '../../../ui-driver/src/Development/OperationsClient.mjs';
import {createNativeFetch} from '../../../ui-driver/src/Development/NativeTransport.mjs';
import {tripView} from '../../../ui-common/src/Development/PilotTrip.mjs';
let listener,timer,quote,rideId,busy=false;
const rideKey='YATRI_PASSENGER_ACTIVE_RIDE';
function rememberRide(id){rideId=id;window.JBridge.setInSharedPrefs(rideKey,id||'');}
export const enabled=()=>{
  try{return window.__OS==='ANDROID'&&window.__YATRI_BR_DEVELOPMENT__===true&&
    JSON.parse(window.JBridge.getDeviceInfo()).package_name==='in.juspay.nammayatri.debug'&&
    Boolean(window.JBridge.getFromSharedPrefs('YATRI_PASSENGER_SESSION'));}catch(_){return false;}
};
function client(){
  if(!enabled())throw Error('Conecte o passageiro ao servidor de testes.');
  return createOperationsClient({role:'passenger',baseUrl:window.JBridge.getFromSharedPrefs('YATRI_PASSENGER_BACKEND_URL'),
    token:window.JBridge.getFromSharedPrefs('YATRI_PASSENGER_SESSION'),
    fetchImpl:createNativeFetch(window.JBridge,callbackMapper.map,id=>{
      const registry=window.__PROXY_FN;if(registry instanceof Map)registry.delete(id);else if(registry)delete registry[id];
    })});
}
function emit(value,owner=listener){if(listener&&owner===listener){listener.changed(value)();window.__YATRI_PASSENGER_RIDE__={id:value.id,phase:value.phase};}}
function fail(error,owner=listener){if(listener&&owner===listener)listener.error(error.message||'Não foi possível atualizar a viagem.')();}
async function refresh(owner=listener){
  const api=client(),data=await api.snapshot();
  if(owner!==listener)return;
  if(data.rides.length){if(rideId!==data.rides[0].id)rememberRide(data.rides[0].id);emit(tripView(data.rides[0]),owner);}
  else if(rideId)emit(tripView(await api.ride(rideId)),owner);
}
export const subscribe=origin=>destination=>changed=>error=>()=>{
  const owner={changed,error};listener=owner;quote=null;busy=false;
  const saved=window.JBridge.getFromSharedPrefs(rideKey);
  rideId=/^[a-f0-9-]{36}$/.test(saved||'')?saved:null;
  (async()=>{
    try{
      const api=client(),data=await api.snapshot();
      if(owner!==listener)return;
      if(data.rides.length){rememberRide(data.rides[0].id);emit(tripView(data.rides[0]),owner);}
      else if(rideId){emit(tripView(await api.ride(rideId)),owner);}
      else{const value=await api.quote(origin,destination);if(owner!==listener)return;quote=value;emit(tripView(value,'quoted'),owner);}
    }catch(e){fail(e,owner);}
  })();
  if(timer)clearInterval(timer);
  let polling=false;
  timer=setInterval(async()=>{if(polling||busy)return;polling=true;try{await refresh(owner);}catch(e){fail(e,owner);}finally{polling=false;}},3000);
  return ()=>{if(listener===owner){listener=null;clearInterval(timer);}};
};
export const request=()=>{
  if(busy||!quote||rideId)return;
  const owner=listener;busy=true;emit(tripView(quote,'requesting'),owner);
  (async()=>{try{const created=await client().requestRide(quote.id);rememberRide(created.id);await refresh(owner);}
    catch(e){fail(e,owner);if(quote)emit(tripView(quote,'quoted'),owner);}finally{busy=false;}})();
};
export const dismiss=()=>{rememberRide(null);};
export const cancel=()=>{
  if(busy||!rideId)return;
  const owner=listener;busy=true;
  (async()=>{try{await client().rideAction(rideId,'cancel');await refresh(owner);}catch(e){fail(e,owner);}finally{busy=false;}})();
};
