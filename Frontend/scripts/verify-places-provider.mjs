// Real provider check; missing credentials are recorded as NOT VALIDATED, never fixture success.
import {mkdir,writeFile} from 'node:fs/promises';
import {mapsService} from '../../brasil/backend/src/maps.mjs';
const evidence={checkedAt:new Date().toISOString(),provider:'Google Places (New)',scope:'provider-only; not Android-to-backend acceptance'};
if(!process.env.GOOGLE_MAPS_SERVER_KEY) evidence.status='not_configured';
else {
  try {
    const maps=mapsService({key:process.env.GOOGLE_MAPS_SERVER_KEY});
    const result=await maps.autocomplete('Avenida Paulista, São Paulo');
    if(!result.suggestions.length) throw new Error('Google não retornou sugestões.');
    const place=await maps.details(result.suggestions[0].placeId);
    if(!Number.isFinite(place.location.lat)||!Number.isFinite(place.location.lng)) throw new Error('Coordenadas inválidas.');
    Object.assign(evidence,{status:'passed',suggestions:result.suggestions.length,selectedAddress:place.address,location:place.location});
  } catch(error) {Object.assign(evidence,{status:'failed',error:error.message});process.exitCode=1;}
}
await mkdir('purescript-diagnostics',{recursive:true});
await writeFile('purescript-diagnostics/places-provider.json',JSON.stringify(evidence,null,2)+'\n');
console.log('Verificação real Google Places:',evidence.status);
