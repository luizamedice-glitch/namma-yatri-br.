import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recoverRideAddresses} from './ride-addresses.mjs';
const points={origin:{lat:-29.1,lng:-51.1,address:'Origem selecionada'},destination:{lat:-29.2,lng:-51.2,address:'Destino selecionado'}};
test('selected address wins over reverse and history',async()=>{
 const p={origin:{...points.origin,address:'Rua A, 10'},destination:{...points.destination,address:'Rua B, 20'}};
 assert.deepEqual(await recoverRideAddresses(p,{user:{id:'p'},pool:{query(){throw Error('unexpected');}},maps:{reverse(){throw Error('unexpected');}}}),p);
});
test('recover exact saved selection for own passenger without changing coordinates',async()=>{
 const calls=[];const result=await recoverRideAddresses(points,{user:{id:'owner'},pool:{query:async(sql,args)=>{calls.push(args);assert.match(sql,/user_id=\$1/);assert.match(sql,/abs\(lat-\$2\)<0.000001/);return {rows:[{address:args[1]===-29.1?'Rua A, 10':'Rua B, 20'}]};}}});
 assert.equal(calls.length,2);assert.equal(result.origin.address,'Rua A, 10');assert.equal(result.destination.address,'Rua B, 20');assert.equal(result.origin.lat,points.origin.lat);
});
test('reverse result names address while preserving selected coordinates',async()=>{
 const result=await recoverRideAddresses(points,{user:{id:'p'},maps:{reverse:async()=>({address:'Rua real, 30',location:{lat:0,lng:0}})}});
 assert.equal(result.destination.address,'Rua real, 30');assert.equal(result.destination.lat,-29.2);
});
test('provider outage keeps ride available with explicit coordinates, no generic text',async()=>{
 const result=await recoverRideAddresses(points,{user:{id:'p'},maps:{reverse:async()=>{throw Error('quota');}}});
 assert.equal(result.origin.address,'-29.100000, -51.100000');assert.equal(points.origin.address,'Origem selecionada');
});
