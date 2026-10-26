// SPDX-License-Identifier: AGPL-3.0-or-later
import {createNativeFetch} from '../../../ui-driver/src/Development/NativeTransport.mjs';
export function createGeoBackend(bridge,mapCallback,removeCallback){
 const fetchImpl=createNativeFetch(bridge,mapCallback,removeCallback);
 return {async reverse(location,{signal}={}){
  let url;const token=bridge.getFromSharedPrefs('YATRI_PASSENGER_SESSION');
  try{url=new URL(bridge.getFromSharedPrefs('YATRI_PASSENGER_BACKEND_URL'));}catch(_){throw Object.assign(Error('Conecte o passageiro ao servidor'),{retryable:false});}
  const local=/^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  if(!/^[a-f0-9]{64}$/.test(token||'')||url.username||url.password||url.search||url.hash||/alce-mobilidade/i.test(url.pathname)||url.protocol!=='https:'&&!(url.protocol==='http:'&&local))
   throw Object.assign(Error('Servidor ou sessão do passageiro inválidos'),{retryable:false});
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,8000);
  try{
   const response=await fetchImpl(url.href.replace(/\/$/,'')+'/v1/places/reverse',{method:'POST',
    headers:{'content-type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({location}),signal:controller.signal});
   if(!response.ok)throw Object.assign(Error('Geocodificação indisponível'),{status:response.status,retryable:response.status>=500&&response.status!==503});
   const result=await response.json();
   if(result?.provider!=='geoapify'||typeof result.address!=='string'||result.address.trim().length<3||result.address.length>1000||!Number.isFinite(result.location?.lat)||!Number.isFinite(result.location?.lng)||Math.abs(result.location.lat)>90||Math.abs(result.location.lng)>180)
    throw Object.assign(Error('Endereço inválido recebido do servidor'),{retryable:false});
   return result;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }};
}
