import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transaction,databaseUnavailable} from '../src/db.mjs';
test('rollback failure preserves original failure and discards broken connection',async()=>{
  const original=Object.assign(new Error('Connection terminated unexpectedly'),{code:'ECONNRESET'});let released;
  const client={query:async sql=>{if(sql==='ROLLBACK')throw Error('broken rollback');},release:error=>{released=error;}};
  await assert.rejects(transaction({connect:async()=>client},async()=>{throw original;}),error=>error===original);
  assert.ok(released instanceof Error);assert.equal(databaseUnavailable(original),true);
});
test('business conflict rolls back while retaining healthy connection',async()=>{
  const conflict=Object.assign(new Error('Invalid transition'),{status:409});let released='not-called';const queries=[];
  const client={query:async sql=>queries.push(sql),release:error=>{released=error;}};
  await assert.rejects(transaction({connect:async()=>client},async()=>{throw conflict;}),error=>error===conflict);
  assert.equal(queries.at(-1),'ROLLBACK');assert.equal(released,undefined);assert.equal(databaseUnavailable(conflict),false);
  assert.equal(databaseUnavailable({code:'23505'}),false);assert.equal(databaseUnavailable({code:'57P01'}),true);
});
