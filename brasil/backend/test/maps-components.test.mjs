import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapsService} from '../src/maps.mjs';
import {geoapifyGeocoding} from '../src/geocoding.mjs';
test('Google details preserve real address components for legacy Android address labels',async()=>{
 let mask;const maps=mapsService({key:'fixture',fetchImpl:async(url,options)=>{mask=options.headers['X-Goog-FieldMask'];return {ok:true,json:async()=>({id:'place-fixture',formattedAddress:'Rua Real, 10',location:{latitude:-29.75,longitude:-57.09},addressComponents:[{longText:'Rua Real',shortText:'R. Real',types:['route']},{longText:'10',shortText:'10',types:['street_number']}]})};}});
 const result=await maps.details('place-fixture');assert.match(mask,/addressComponents/);assert.equal(result.addressComponents[0].long_name,'Rua Real');assert.equal(result.addressComponents[1].short_name,'10');
});
test('Geoapify translates only actual provider metadata, retaining attribution and coordinates',async()=>{
 const geo=geoapifyGeocoding({key:'x'.repeat(30),fetchImpl:async()=>({ok:true,json:async()=>({results:[{formatted:'Rua Real, 10',lat:-29.75,lon:-57.09,street:'Rua Real',housenumber:'10',city:'Uruguaiana',state:'Rio Grande do Sul',state_code:'RS',country:'Brasil',country_code:'br'}]})})});
 const result=await geo.reverse({lat:-29.75,lng:-57.09});assert.equal(result.provider,'geoapify');assert.ok(result.attribution);
 assert.deepEqual(result.addressComponents.find(x=>x.types[0]==='administrative_area_level_1'),{long_name:'Rio Grande do Sul',short_name:'RS',types:['administrative_area_level_1']});
 assert.equal(result.addressComponents.some(x=>x.types[0]==='postal_code'),false);
});
