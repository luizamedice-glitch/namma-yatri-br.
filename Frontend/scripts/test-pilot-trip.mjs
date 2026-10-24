import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tripView} from '../ui-common/src/Development/PilotTrip.mjs';
test('trip presentation preserves server amount, actual addresses and assignment',()=>{
  const result=tripView({id:'trip',status:'accepted',origin:{address:'Praça da Sé'},destination:{address:'Av. Paulista'},
    fare_cents:1234,route:{distanceMeters:4250},passenger_name:'Fagner',driver_name:'Giselo',model:'Modelo de teste',color:'Prata',plate:'TST1A23'});
  assert.match(result.fare,/12,34/);assert.equal(result.origin,'Praça da Sé');assert.equal(result.driver,'Giselo');
  assert.equal(result.phase,'accepted');assert.match(result.distance,/4,3/);
  assert.throws(()=>tripView({fareCents:NaN}),/inválido/);
});
