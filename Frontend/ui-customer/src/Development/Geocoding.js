// SPDX-License-Identifier: AGPL-3.0-or-later
import {callbackMapper} from 'presto-ui';
let listener,sequence=0,pending,pendingKey;
const cache=new Map();
function allowed(){try{return window.__OS==='ANDROID'&&window.__YATRI_BR_DEVELOPMENT__===true&&
  JSON.parse(window.JBridge.getDeviceInfo()).package_name==='in.juspay.nammayatri.debug';}catch(_){return false;}}
function status(state){
  const previous=window.__YATRI_GEOCODING__||{requests:0,successes:0,failures:0};
  window.__YATRI_GEOCODING__={...previous,state,
    requests:previous.requests+(state==='loading'?1:0),successes:previous.successes+(state==='resolved'?1:0),
    failures:previous.failures+(state==='unavailable'?1:0)};
}
function remove(id){const registry=window.__PROXY_FN;
  if(Object.prototype.toString.call(registry)==='[object Map]')registry.delete(id);else if(registry)delete registry[id];}
export const subscribe=changed=>positionChanged=>()=>{
  if(pending)pending();const owner={changed,positionChanged};listener=owner;sequence++;
  return ()=>{if(listener===owner){listener=null;sequence++;if(pending)pending();}};
};
export const resolve=lat=>lng=>()=>{
  if(!allowed()||!listener||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||(lat===0&&lng===0))return;
  const owner=listener,key=lat.toFixed(4)+','+lng.toFixed(4),cached=cache.get(key),now=Date.now();
  if(pending&&pendingKey===key)return;
  const version=++sequence;
  if(pending)pending();
  if(cached&&now-cached.at<(cached.address?600000:30000)){
    if(cached.address)Promise.resolve().then(()=>{if(listener===owner&&version===sequence)owner.changed(lat)(lng)(cached.address)();});
    return;
  }
  if(typeof window.JBridge.reverseGeocodeYatri!=='function'){status('unavailable');return;}
  status('loading');let id,timer,done=false;
  const finish=(result,address)=>{
    if(done)return;done=true;clearTimeout(timer);if(id!==undefined)remove(id);if(pending===cancel)pending=null;
    if(listener!==owner||version!==sequence)return;
    const valid=result==='ok'&&typeof address==='string'&&address.trim().length>=3&&address.length<=1000;
    cache.set(key,{at:Date.now(),address:valid?address.trim():''});if(cache.size>16)cache.delete(cache.keys().next().value);
    status(valid?'resolved':'unavailable');
    if(valid)Promise.resolve().then(()=>{if(listener===owner&&version===sequence)owner.changed(lat)(lng)(address.trim())();});
  };
  const cancel=()=>{done=true;clearTimeout(timer);if(id!==undefined)remove(id);if(pending===cancel)pending=null;};
  pending=cancel;pendingKey=key;
  timer=setTimeout(()=>finish('timeout',''),8000);
  try{id=callbackMapper.map(finish);if(window.JBridge.reverseGeocodeYatri(lat,lng,id)!==true)finish('unavailable','');}
  catch(_){finish('unavailable','');}
};

// Reuse the original GPS callback used by the recenter button. Defer UI delivery.
export const position=lat=>lng=>()=>{
  const owner=listener;
  if(!allowed()||!owner)return;
  Promise.resolve().then(()=>{if(listener===owner)owner.positionChanged(lat)(lng)();});
};
