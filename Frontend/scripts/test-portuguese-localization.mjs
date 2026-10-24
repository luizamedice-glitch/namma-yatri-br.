import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const dir = new URL('../ui-customer/src/Localization/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('pt-BR.json', dir), 'utf8'));
let source = await readFile(new URL('Runtime.js', dir), 'utf8');
source = source.replace("import catalog from './pt-BR.json';", `const catalog = ${JSON.stringify(catalog)};`);
globalThis.window = {};
const runtime = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const original = {where_are_you_going: 'Where are you going?', night_time_charges: a => b => `${a} to ${b}`, sentinel: 'unchanged'};
let record = runtime.createPortugueseRecord(original);
record = runtime.createPortugueseRecord(original);
assert.equal(record, original);
function device(name, flag=true, os='ANDROID') {
 globalThis.window = {__OS:os,__YATRI_BR_DEVELOPMENT__:true,__YATRI_BR_PT_BR__:flag,
 JBridge:{getDeviceInfo:()=>JSON.stringify({package_name:name})}};
}
device('in.juspay.nammayatri');
record = runtime.createPortugueseRecord(original);
assert.equal(record, original);
assert.equal(record.night_time_charges, original.night_time_charges);
device('in.juspay.nammayatri.debug',false);
record = runtime.createPortugueseRecord(original);
assert.equal(record, original);
device('in.juspay.nammayatri.debug',true,'WEB');
record = runtime.createPortugueseRecord(original);
assert.equal(record, original);
device('in.juspay.nammayatri.debug');
record = runtime.createPortugueseRecord(original);
assert.equal(record.where_are_you_going,'Para onde você vai?');
assert.equal(record.sentinel,'unchanged');
assert.equal(runtime.localizeLiteral('Navigation : Button'),'Navegação: botão');
assert.equal(runtime.localizeLiteral('Av. Paulista - São Paulo'),'Av. Paulista - São Paulo');
const all = runtime.createPortugueseRecord(Object.fromEntries(Object.keys(catalog.messages).map(k => [k, k])));
for (const [key, value] of Object.entries(catalog.messages)) {
 assert.ok(value.text.trim() || catalog.emptyMessages.includes(key), key);
 assert.ok(!value.text.includes('⁇'), key);
 if (value.arity) {
  let f = all[key];
  for (let i=0;i<value.arity;i++) f=f(`ARG_${i}_São Paulo_12,50`);
  assert.equal(typeof f,'string',key);
  for (const m of value.text.matchAll(/\{(\d+)\}/g)) assert.ok(f.includes(`ARG_${m[1]}_São Paulo_12,50`),key);
 }
}
assert.equal(Object.keys(catalog.messages).length,1789);
console.log('PASS: 1789 messages, curried parameters, literal display strings and release/web isolation');
