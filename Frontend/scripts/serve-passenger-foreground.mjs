// SPDX-License-Identifier: AGPL-3.0-or-later
// Isolated CI database/API; only Google maps queries use the existing maps-test service.
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {connectDatabase} from '../../brasil/backend/src/db.mjs';
import {migrate} from '../../brasil/backend/src/migrate.mjs';
import {developmentAccounts} from '../../brasil/backend/src/development.mjs';
import {mobilityService} from '../../brasil/backend/src/mobility.mjs';
import {createApi} from '../../brasil/backend/src/http.mjs';
const pool=await connectDatabase(process.env.DATABASE_URL);
await migrate(pool);
const credentials={passenger:randomBytes(32).toString('hex'),driver:randomBytes(32).toString('hex')};
const development=await developmentAccounts(pool,{enabled:true,passengerKey:credentials.passenger,driverKey:credentials.driver,
  vehicle:{plate:'TST1A23',model:'Veículo do teste isolado',color:'Prata'}});
const sessions={};
for(const role of ['passenger','driver'])sessions[role]=(await development.session({role,credential:credentials[role]})).token;
const maps={route:async(origin,destination)=>{
  const response=await fetch('https://52-67-246-31.sslip.io/v1/test/routes',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({origin,destination}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Google Routes indisponível no serviço de mapas de teste');
  const route=(await response.json()).routes?.[0];
  if(!route?.encodedPolyline||route.encodedPolyline==='fixture-only'||!(route.distanceMeters>0))throw Error('Rota Google incompleta');
  return route;
}};
const service=mobilityService(pool,maps,{allowDevelopmentAccounts:true});
const server=createApi({pool,maps,service,development});
// CI-only, one-shot loss of the actual committed POST response; no fake API data.
const faultPath=process.env.PASSENGER_FOREGROUND_SESSIONS+'.faults';
const faults={armed:false,requests:0,droppedResponses:0};
const saveFaults=()=>writeFileSync(faultPath,JSON.stringify(faults),{mode:0o600});
process.on('SIGWINCH',()=>{faults.armed=true;saveFaults();});
server.prependListener('request',(request,response)=>{
  if(request.method!=='POST'||request.url!=='/v1/rides')return;
  faults.requests++;saveFaults();
  if(!faults.armed)return;
  faults.armed=false;
  const end=response.end;
  response.end=function(...args){
    if(response.statusCode>=200&&response.statusCode<300){
      faults.droppedResponses++;saveFaults();
      // Send the start of the REAL response before truncating it. Closing before
      // headers may trigger transparent POST replay inside HttpURLConnection.
      response.flushHeaders();
      const body=args[0];if(body&&body.length)response.write(body.slice(0,1));
      setTimeout(()=>response.destroy(),50);return response;
    }
    return end.apply(this,args);
  };
});
await new Promise(resolve=>server.listen(8080,'127.0.0.1',resolve));
await writeFile(process.env.PASSENGER_FOREGROUND_SESSIONS,JSON.stringify(sessions),{mode:0o600});
console.log('API isolada pronta. Nenhuma operação de corrida usa o Lightsail.');
// CI-only fault injection: drop existing keep-alive sockets, keeping API/PG alive.
process.on('SIGUSR2',()=>{
  server.closeAllConnections();faults.cuts=(faults.cuts||0)+1;saveFaults();
});
process.on('SIGTERM',()=>{server.closeStreams();server.closeAllConnections();server.close(()=>pool.end().then(()=>process.exit()));});
