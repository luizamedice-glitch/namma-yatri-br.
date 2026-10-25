// SPDX-License-Identifier: AGPL-3.0-or-later
import {createOperationsClient} from '../../src/Development/OperationsClient.mjs';
import {createNativeFetch} from '../../src/Development/NativeTransport.mjs';
import {callbackMapper} from 'presto-ui';
import {updateTripMap,releaseTripMap} from '../../../ui-common/src/Development/TripMapRuntime.js';
import {tripView} from '../../../ui-common/src/Development/PilotTrip.mjs';
let online, failure, timer, position, lastError, changed, lastAvailable, lastTrip, actionBusy=false;
let nav=null,navAt=0,navPhase,published;
let snapshotRevision=0,lastRide=null,lastPhase='idle';
const rideKey='YATRI_DRIVER_ACTIVE_RIDE';
const emptyTrip=()=>({id:'',phase:'idle',origin:'',destination:'',fare:'',distance:'',passenger:'',driver:'',vehicle:'',polyline:'',driverLat:0,driverLng:0,gpsFresh:false,tracking:''});
function rememberRide(id){lastRide=id;window.JBridge.setInSharedPrefs(rideKey,id||'');}
function publishTrip(trip){
  published=trip;
  if(trip.phase==='idle')releaseTripMap();else updateTripMap(trip);
  const serialized=JSON.stringify(trip);
  if(changed&&serialized!==lastTrip){
    lastTrip=serialized;lastPhase=trip.phase;changed(trip)();
    window.__YATRI_DRIVER_RIDE__={id:trip.id,phase:trip.phase};
    if(trip.phase==='offer')try{navigator.vibrate(300);}catch(_){}
  }
}
export const enabled = () => {
  try { return window.__OS === 'ANDROID' && window.__YATRI_BR_DEVELOPMENT__ === true &&
    JSON.parse(window.JBridge.getDeviceInfo()).package_name === 'in.juspay.nammayatripartner.debug';
  } catch (_) { return false; }
};
export const checkpoint = phase => () => {
  if (enabled()) window.__YATRI_DRIVER_STARTUP__ = {phase};
};
// PrestoDOM's legacy Core2 copies the parent's registry during module loading.
// The driver entry initialized the Map flag earlier; resynchronize its type after
// imports, preserving the registry and every callback already registered by SDK.
export const prepareRuntime = () => {
  if (enabled()) window.__PROXY_FN_MAP_TYPE = window.__PROXY_FN instanceof Map;
};
export const startupError = message => () => {
  if (!enabled()) return;
  const detail = String(message).replace(/\b[a-fA-F0-9]{64}\b/g,'[REDACTED_SESSION]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED_KEY]');
  window.__YATRI_DRIVER_STARTUP__ = {phase:'failed',detail};
  console.error('Yatri driver startup:',detail);
};
function client() {
  if (!enabled()) throw Error('Operação restrita ao motorista BR debug.');
  return createOperationsClient({baseUrl:window.JBridge.getFromSharedPrefs('YATRI_DRIVER_BACKEND_URL'),
    token:window.JBridge.getFromSharedPrefs('YATRI_DRIVER_SESSION'),
    fetchImpl:createNativeFetch(window.JBridge,callbackMapper.map,id => {
      const registry=window.__PROXY_FN;
      if (registry instanceof Map) registry.delete(id); else if (registry) delete registry[id];
    })});
}
function failed(error) {
  if(published&&published.phase!=='idle')publishTrip({...published,gpsFresh:false,tracking:'Sem atualização — verificando conexão'});
  const message = error.message || 'Não foi possível conectar ao servidor operacional.';
  window.__YATRI_DRIVER_OPERATIONS__ = {connected:false,error:message};
  if (failure && lastError !== message) failure(message)();
  lastError = message;
}
function trackingActive(){try{return typeof window.JBridge.isYatriDriverTrackingActive==='function'&&window.JBridge.isYatriDriverTrackingActive()===true;}catch(_){return false;}}
function syncTracking(wanted){try{if(typeof window.JBridge.setYatriDriverTracking==='function')window.JBridge.setYatriDriverTracking(wanted);}catch(_){} }
async function snapshot() {
  const owner=changed,revision=++snapshotRevision;
  try {
    const api=client(),data = await api.snapshot();
    if(owner!==changed||revision!==snapshotRevision)return;
    syncTracking(data.available===true||data.rides.length>0);
    let ride=data.rides[0]||data.offers[0],phase=data.rides.length?ride.status:'offer';
    if(data.rides.length&&lastRide!==ride.id)rememberRide(ride.id);
    // Active-only snapshots omit terminal trips. Read the actual persisted trip
    // before dismissing its UI, including after Activity/process recreation.
    if(!ride&&lastRide){ride=await api.ride(lastRide);phase=ride.status;}
    if(owner!==changed||revision!==snapshotRevision)return;
    if (online && lastAvailable!==data.available){lastAvailable=data.available;online(data.available === true)();}
    if(ride&&['accepted','arrived'].includes(ride.status)){
      if(!navAt||Date.now()-navAt>30000||navPhase!==ride.status){
        navAt=Date.now();navPhase=ride.status;
        try{
          const nextNavigation=await api.navigation(ride.id);
          if(owner!==changed||revision!==snapshotRevision)return;
          nav=nextNavigation;
        }catch(error){if(owner!==changed||revision!==snapshotRevision)return;nav=null;failed(error);}
      }
      ride={...ride,route:{...ride.route,encodedPolyline:nav?nav.route.encodedPolyline:''}};
    }else{nav=null;navPhase=ride&&ride.status;}
    if(owner!==changed||revision!==snapshotRevision)return;
    publishTrip(ride?tripView(ride,phase):emptyTrip());
    lastError = null;
    window.__YATRI_DRIVER_OPERATIONS__ = {connected:true, offers:data.offers.length, rides:data.rides.length};
  } catch (error) { if(owner===changed&&revision===snapshotRevision)failed(error); }
}
export const subscribe = ok => fail => gps => updates => () => {
  online = ok; failure = fail;changed=updates;lastAvailable=undefined;lastTrip=undefined;
  const saved=window.JBridge.getFromSharedPrefs(rideKey);
  lastRide=/^[a-f0-9-]{36}$/.test(saved||'')?saved:null;
  if (timer) clearInterval(timer);
  snapshot();
  const resume=()=>{if(!actionBusy)snapshot();};
  if(window.addEventListener){window.addEventListener('online',resume);window.addEventListener('focus',resume);}
  let busy = false;
  timer = setInterval(async () => {
    if (busy||actionBusy) return;
    busy = true;
    try { gps(); await snapshot(); } finally { busy = false; }
  }, 5000);
  return () => { clearInterval(timer); timer = null;if(window.removeEventListener){window.removeEventListener('online',resume);window.removeEventListener('focus',resume);} online = failure = changed = null;snapshotRevision++;releaseTripMap(); };
};
export const act = action => id => () => {
  if(!enabled()||actionBusy||!['accept','reject','arrive','start','complete','cancel'].includes(action))return;
  actionBusy=true;
  (async()=>{try{await client().rideAction(id,action);await snapshot();}catch(error){failed(error);}finally{actionBusy=false;}})();
};
export const dismissTrip=()=>{
  if(!enabled()||!['completed','cancelled'].includes(lastPhase))return;
  // The controller commits its local close action. Never push synchronously
  // back into PrestoDOM's state scan while that same click is being evaluated.
  rememberRide(null);releaseTripMap();snapshotRevision++;lastTrip=undefined;lastPhase='idle';snapshot();
};
export const location = lat => lng => () => {
  if (!enabled()) return;
  position = {lat,lng};
  if(trackingActive())return;
  try { client().location(lat,lng).catch(failed); } catch (error) { failed(error); }
};
export const availability = available => ok => fail => () => {
  (async () => {
    try {
      const api = client();
      if (available) {
        if(typeof window.JBridge.prepareYatriDriverTracking==='function'&&!window.JBridge.prepareYatriDriverTracking())
          throw Error('Autorize localização e notificações e toque novamente em Ficar disponível.');
        if (!position) throw Error('Aguarde uma localização GPS válida antes de ficar disponível.');
        await api.location(position.lat,position.lng);
      }
      const data = await api.availability(available);
      snapshotRevision++;lastAvailable=data.available;
      syncTracking(data.available===true||['accepted','arrived','in_progress'].includes(lastPhase));
      ok(data.available)();
      if (online) online(data.available)();
      lastError = null;
    } catch(error) { failed(error); fail(error.message)(); }
  })();
};
