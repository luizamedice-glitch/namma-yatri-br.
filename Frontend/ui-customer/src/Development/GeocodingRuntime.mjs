// SPDX-License-Identifier: AGPL-3.0-or-later
import {createGeoBackend} from './GeoBackend.mjs';
export function createGeocoding(callbackMapper){
 let listener,sequence=0,pending;const cache=new Map();
 function allowed(){try{return window.__OS==='ANDROID'&&window.__YATRI_BR_DEVELOPMENT__===true&&
  JSON.parse(window.JBridge.getDeviceInfo()).package_name==='in.juspay.nammayatri.debug';}catch(_){return false;}}
 function status(state){const previous=window.__YATRI_GEOCODING__||{requests:0,successes:0,failures:0};
  window.__YATRI_GEOCODING__={...previous,provider:'geoapify',state,requests:previous.requests+(state==='loading'?1:0),
   successes:previous.successes+(state==='resolved'?1:0),failures:previous.failures+(state==='unavailable'?1:0)};}
 function remove(id){const registry=window.__PROXY_FN;if(Object.prototype.toString.call(registry)==='[object Map]')registry.delete(id);else if(registry)delete registry[id];}
 const subscribe=changed=>positionChanged=>()=>{
  if(pending)pending.cancel();const owner={changed,positionChanged};listener=owner;sequence++;
  return ()=>{if(listener===owner){listener=null;sequence++;if(pending)pending.cancel();}};
 };
 function resolveAt(lat,lng,attempt=0){
  if(!allowed()||!listener||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||(lat===0&&lng===0))return;
  const owner=listener,key=lat.toFixed(4)+','+lng.toFixed(4),cached=cache.get(key),now=Date.now();
  if(pending?.key===key)return;
  const version=++sequence;if(pending)pending.cancel();
  const current=()=>listener===owner&&sequence===version;
  if(cached&&(cached.address||attempt===0)&&now-cached.at<(cached.address?600000:30000)){
   if(cached.address)Promise.resolve().then(()=>{if(current())owner.changed(lat)(lng)(cached.address)();});return;
  }
  const controller=new AbortController(),request={key,cancel:()=>{controller.abort();if(pending===request)pending=null;}};
  pending=request;status('loading');
  createGeoBackend(window.JBridge,callbackMapper.map,remove).reverse({lat,lng},{signal:controller.signal}).then(result=>{
   if(!current())return;cache.set(key,{at:Date.now(),address:result.address});status('resolved');
   Promise.resolve().then(()=>{if(current())owner.changed(lat)(lng)(result.address)();});
  }).catch(error=>{
   if(!current())return;cache.set(key,{at:Date.now(),address:''});status('unavailable');
   if(attempt<2&&error.retryable!==false){
    const retry={key,cancel:()=>{clearTimeout(retry.timer);if(pending===retry)pending=null;}};
    retry.timer=setTimeout(()=>{if(pending===retry)pending=null;if(current())resolveAt(lat,lng,attempt+1);},1500);pending=retry;
   }
  }).finally(()=>{if(pending===request)pending=null;if(cache.size>16)cache.delete(cache.keys().next().value);});
 }
 const resolve=lat=>lng=>()=>resolveAt(lat,lng);
 const position=lat=>lng=>()=>{const owner=listener;if(!allowed()||!owner)return;
  Promise.resolve().then(()=>{if(listener===owner)owner.positionChanged(lat)(lng)();});};
 return {subscribe,resolve,position};
}
