// Real API in a killable process. Only Google transport is an explicit fixture.
import pg from 'pg';
import {mobilityService} from '../../src/mobility.mjs';
import {createApi} from '../../src/http.mjs';
if(!/^recovery_[a-f0-9]{32}$/.test(process.env.RECOVERY_SCHEMA||''))throw Error('TEST_SCHEMA_REQUIRED');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,options:'-c search_path='+process.env.RECOVERY_SCHEMA});
const maps={route:async()=>({distanceMeters:1200,durationSeconds:240,encodedPolyline:'fixture-only',fareCents:740})};
const service=mobilityService(pool,maps,{inviteCode:'recovery-invite-fixture-only'});
const server=createApi({pool,maps,service,rateLimit:1000});
let drop;
process.on('message',message=>{
  if(message.type==='arm'){drop=message.path;process.send({type:'armed'});}
});
server.prependListener('request',(request,response)=>{
  if(request.method!=='POST'||request.url!==drop)return;
  drop=null;const end=response.end;
  response.end=function(...args){
    if(response.statusCode===200){
      // The actual handler has COMMITted. Sending headers/body prefix prevents
      // a transport from silently replaying this POST before we restart Node.
      response.flushHeaders();if(args[0]?.length)response.write(args[0].slice(0,1));
      setTimeout(()=>response.destroy(),25);return response;
    }
    return end.apply(this,args);
  };
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
process.send({type:'ready',port:server.address().port});
