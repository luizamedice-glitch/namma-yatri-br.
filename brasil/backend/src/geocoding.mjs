// SPDX-License-Identifier: AGPL-3.0-or-later
import {ApiError,position,requireThat} from './domain.mjs';
export function geoapifyGeocoding({key,fetchImpl=fetch,now=Date.now,dailyLimit=500}={}){
  const cache=new Map(),pending=new Map();let day=-1,used=0;
  return {async reverse(location){
    const point=position(location);
    requireThat(point.lat!==0||point.lng!==0,400,'Coordenadas GPS indisponíveis');
    requireThat(typeof key==='string'&&key.length>=20&&key.length<=256,503,'Geoapify não configurado no servidor');
    const id=point.lat.toFixed(4)+','+point.lng.toFixed(4),hit=cache.get(id);
    if(hit&&hit.until>now())return hit.value;
    if(pending.has(id))return pending.get(id);
    requireThat(pending.size<4,429,'Muitas consultas de endereço; aguarde um momento');
    const today=Math.floor(now()/86400000);if(today!==day){day=today;used=0;}
    requireThat(Number.isInteger(dailyLimit)&&dailyLimit>=1&&dailyLimit<=3000,503,'Limite de geocoding inválido');
    requireThat(used<dailyLimit,429,'Limite diário de geocodificação de testes atingido');used++;
    const request=Promise.resolve().then(async()=>{
      try{
        const query=new URLSearchParams({lat:String(point.lat),lon:String(point.lng),lang:'pt',format:'json',apiKey:key});
        const response=await fetchImpl('https://api.geoapify.com/v1/geocode/reverse?'+query,{signal:AbortSignal.timeout(8000)});
        requireThat(response.ok,response.status===429?429:502,'Geoapify indisponível; verifique configuração ou tente novamente');
        const data=await response.json(),result=data.results?.[0];
        requireThat(result,404,'Nenhum endereço encontrado para esta localização');
        requireThat(typeof result.formatted==='string'&&result.formatted.trim().length>=3&&result.formatted.length<=1000,502,'Resposta de endereço inválida');
        requireThat(Number.isFinite(result.lat)&&Number.isFinite(result.lon)&&Math.abs(result.lat)<=90&&Math.abs(result.lon)<=180,502,'Coordenadas inválidas no serviço de endereços');
        const resolved={lat:result.lat,lng:result.lon};
        const value={address:result.formatted.trim(),location:resolved,provider:'geoapify',
          attribution:{provider:'Geoapify',url:'https://www.geoapify.com/',data:'© OpenStreetMap contributors',dataUrl:'https://www.openstreetmap.org/copyright'}};
        cache.set(id,{value,until:now()+600000});if(cache.size>256)cache.delete(cache.keys().next().value);
        return value;
      }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(502,'Não foi possível consultar o serviço de endereços');}
      finally{pending.delete(id);}
    });pending.set(id,request);return request;
  }};
}
