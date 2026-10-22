// Explicit contract fixtures, not evidence of Google or a running Yatri deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createPlacesClient, validateConfig, validPosition} from '../ui-customer/src/Development/PlacesClient.mjs';
const credential = 'a'.repeat(64), token = 'b'.repeat(64);
const config = {backendUrl:'http://10.0.2.2:8080',passengerCredential:credential};
const session = {token,user:{id:'b1a51100-0000-4000-8000-000000000001',role:'passenger'}};
const suggestion = {placeId:'fixture_place',address:'Endereço de fixture, Cidade de teste'};
const place = {placeId:suggestion.placeId,address:suggestion.address,location:{lat:-23.5,lng:-46.6}};
const tick = () => new Promise(resolve => setTimeout(resolve,10));

test('configuração aceita somente HTTPS/rede privada e rejeita serviço Alce/credenciais ausentes', () => {
  for (const backendUrl of ['', 'file:///tmp/a','http://public.example','https://u:p@example.test','https://example.test?token=abc','https://example.test/functions/v1/alce-mobilidade'])
    assert.throws(() => validateConfig({...config,backendUrl}));
  assert.throws(() => validateConfig({...config,passengerCredential:''}));
  assert.equal(validateConfig({...config,backendUrl:'https://yatri.example.test/'}).base,'https://yatri.example.test');
});
test('autocomplete/detalhes seguem contrato brasileiro e só autenticam Fagner',async () => {
  const calls=[];
  const client=createPlacesClient(config,async (url,payload,bearer)=>{
    calls.push({url,payload,bearer});
    if (url.endsWith('/session')) return session;
    if (url.endsWith('/autocomplete')) return {suggestions:[suggestion]};
    return place;
  });
  assert.equal((await client.autocomplete('  Rua de fixture  ',{lat:-23,lng:-46}))[0].title,'Endereço de fixture');
  assert.deepEqual(await client.details(suggestion.placeId),{...place.location,placeId:place.placeId,address:place.address});
  assert.deepEqual(calls[0].payload,{role:'passenger',credential});
  assert.equal(calls[1].bearer,token); assert.equal(calls[2].bearer,token);
  assert.deepEqual(calls[1].payload,{input:'Rua de fixture',location:{lat:-23,lng:-46}});
});
test('GPS ausente não envia viés 0,0; busca curta não chama servidor',async () => {
  const calls=[]; const client=createPlacesClient(config,async (u,p)=>{calls.push(p);return u.endsWith('/session') ? session : {suggestions:[]};});
  assert.deepEqual(await client.autocomplete('ab'),[]); assert.equal(calls.length,0);
  await client.autocomplete('fixture',{lat:0,lng:0}); assert.deepEqual(calls[1],{input:'fixture'});
  assert.equal(validPosition({lat:Infinity,lng:0}),false);
});
test('sessão expirada é renovada uma vez; falhas de rede não produzem sugestões',async () => {
  let auth=0, searches=0;
  const client=createPlacesClient(config,async u=>{
    if(u.endsWith('/session')) {auth++;return session;}
    searches++; const error=new Error('recusado');error.status=401;throw error;
  });
  await assert.rejects(client.autocomplete('fixture'),/recusado/);
  assert.equal(auth,2);assert.equal(searches,2);
});
test('sessões concorrentes não duplicam provisionamento; identidade de motorista é recusada',async () => {
  let auth=0;
  const client=createPlacesClient(config,async u=>{if(u.endsWith('/session')) {auth++;await tick();return session;}return {suggestions:[]};});
  await Promise.all([client.autocomplete('primeira'),client.autocomplete('segunda')]);assert.equal(auth,1);
  const invalid=createPlacesClient(config,async()=>({...session,user:{...session.user,role:'driver'}}));
  await assert.rejects(invalid.autocomplete('fixture'),/Sessão/);
});
test('contratos inválidos e coordenadas não finitas são recusados',async () => {
  for(const bad of [null,{suggestions:null},{suggestions:[{placeId:'a',address:'x'}]}]) {
    const c=createPlacesClient(config,async u=>u.endsWith('/session') ? session : bad);
    await assert.rejects(c.autocomplete('fixture'));
  }
  for(const location of [{lat:91,lng:0},{lat:0,lng:0},{lat:-23,lng:NaN}]) {
    const c=createPlacesClient(config,async u=>u.endsWith('/session') ? session : {...place,location});
    await assert.rejects(c.details(place.placeId),/coordenadas/);
  }
});
async function runtime(handler,device='in.juspay.nammayatri.debug') {
  const callbacks=new Map();let next=1;
  globalThis.__placesTestMapper={map:cb=>{const id=String(next++);callbacks.set(id,cb);return id;}};
  globalThis.window={__OS:'ANDROID',__YATRI_BR_DEVELOPMENT__:true,atob:s=>Buffer.from(s,'base64').toString('binary'),JBridge:{
    getDeviceInfo:()=>JSON.stringify({package_name:device}),loadFileInDUI:()=>JSON.stringify(config),
    callAPI:(_method,url,body,headers,_form,_pin,cb)=>{
      const payload=JSON.parse(body); const h=JSON.parse(headers);
      Promise.resolve(handler(url,payload,h)).then(({status=200,data,encoding='base64'})=>{
        const text=JSON.stringify(data);
        callbacks.get(cb)('success',encoding==='plain'?text:Buffer.from(text).toString('base64'),String(status),'','',encoding==='uri'?encodeURIComponent(text):'');callbacks.delete(cb);
      });
    }
  }};
  let source=await readFile(new URL('../ui-customer/src/Development/Places.js',import.meta.url),'utf8');
  source=source.replace("import {callbackMapper} from 'presto-ui';",'const callbackMapper=globalThis.__placesTestMapper;')
    .replace("'../../src/Development/PlacesClient.mjs'",JSON.stringify(new URL('../ui-customer/src/Development/PlacesClient.mjs',import.meta.url).href));
  return import('data:text/javascript;base64,'+Buffer.from(source+'\n//'+Math.random()).toString('base64'));
}
test('FFI nativo: base64, URL encoding, seleção e erro HTTP sem exposição de tokens',async () => {
  const module=await runtime(async u=>u.endsWith('/session') ? {data:session} : u.endsWith('/autocomplete') ? {data:{suggestions:[suggestion]},encoding:'uri'} : {data:place,encoding:'plain'});
  const events=[];
  const stop=module.subscribe(field=>items=>()=>events.push({field,items}))(field=>p=>()=>events.push({field,place:p}))(e=>()=>events.push({error:e}))();
  module.inputChanged('fixture')(false)();module.autocomplete('fixture')(false)(0)(0)();await tick();
  assert.equal(events[0].items[0].placeId,suggestion.placeId);
  module.details(place.placeId)(false)();await tick();assert.equal(events[1].place.lat,place.location.lat);
  assert.equal(window.__YATRI_BR_PLACES_STATE__.destination.address,place.address);
  assert.ok(!JSON.stringify(window.__YATRI_BR_PLACES_STATE__).includes(token));stop();
});
test('FFI descarta buscas antigas, mudança de campo, cancelamento e callbacks após desmontagem',async () => {
  let resolveOld;
  const module=await runtime(async (u,p)=>u.endsWith('/session') ? {data:session} : p.input==='antiga' ? await new Promise(r=>resolveOld=r) : {data:{suggestions:[suggestion]}});
  const events=[]; const stop=module.subscribe(f=>xs=>()=>events.push({f,xs}))(_=>_=>()=>{})(e=>()=>events.push({error:e}))();
  module.inputChanged('antiga')(false)();module.autocomplete('antiga')(false)(0)(0)();await tick();
  module.inputChanged('nova')(true)();module.autocomplete('nova')(true)(0)(0)();await tick();
  resolveOld({data:{suggestions:[{...suggestion,placeId:'old_fixture'}]}});await tick();
  assert.equal(events.length,1);assert.equal(events[0].f,true);
  module.inputChanged('terceira')(false)();module.autocomplete('terceira')(false)(0)(0)();module.cancel();await tick();assert.equal(events.length,1);
  stop();module.details(place.placeId)(false)();await tick();assert.equal(events.length,1);
});
test('FFI configurações ausentes/503/release não travam e não inventam resultados',async () => {
  let calls=0;const module=await runtime(async u=>{calls++;return u.endsWith('/session')?{data:session}:{status:503,data:{error:'chave ausente'}};});
  const events=[];const stop=module.subscribe(_=>_=>()=>assert.fail('Não deve haver sugestões'))(_=>_=>()=>assert.fail('Não deve haver seleção'))(e=>()=>events.push(e))();
  module.inputChanged('fixture')(false)();module.autocomplete('fixture')(false)(0)(0)();await tick();assert.match(events[0],/configure/);stop();
  const release=await runtime(async()=>{assert.fail('Release não deve chamar servidor');},'in.juspay.nammayatri');
  release.subscribe(_=>_=>()=>{})(_=>_=>()=>{})(_=>()=>{})();release.inputChanged('fixture')(false)();release.autocomplete('fixture')(false)(0)(0)();await tick();
  assert.equal(calls,2);
});

test('FFI sem configuração retorna erro explícito sem iniciar HTTP',async () => {
  const module=await runtime(async()=>{assert.fail('Backend não configurado não deve receber HTTP');});
  window.JBridge.loadFileInDUI=()=>JSON.stringify({backendUrl:'',passengerCredential:''});
  const events=[]; const stop=module.subscribe(_=>_=>()=>assert.fail('Não há sugestões'))(_=>_=>()=>{})(e=>()=>events.push(e))();
  module.inputChanged('fixture')(false)();module.autocomplete('fixture')(false)(0)(0)();await tick();
  assert.match(events[0],/não configurado/);assert.equal(window.__YATRI_BR_PLACES_STATE__.phase,'error');stop();
});

test('após falha de conexão, nova pesquisa funciona sem sessão presa nem resultados antigos',async () => {
  let auth=0, searches=0;
  const client=createPlacesClient(config,async u=>{
    if(u.endsWith('/session')) {auth++;return session;}
    if(++searches===1) throw new Error('offline de fixture');
    return {suggestions:[suggestion]};
  });
  await assert.rejects(client.autocomplete('primeira fixture'),/offline/);
  assert.equal((await client.autocomplete('segunda fixture'))[0].placeId,suggestion.placeId);
  assert.equal(auth,1);assert.equal(searches,2);
});
