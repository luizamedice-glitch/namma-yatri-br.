// Real API in a killable process. Only Google transport is an explicit fixture.
import {connectDatabase} from '../../src/db.mjs';
import {mobilityService} from '../../src/mobility.mjs';
import {createApi} from '../../src/http.mjs';
if(!/^recovery_[a-f0-9]{32}$/.test(process.env.RECOVERY_SCHEMA||''))throw Error('TEST_SCHEMA_REQUIRED');
const database=new URL(process.env.DATABASE_URL);database.searchParams.set('options','-c search_path='+process.env.RECOVERY_SCHEMA);
const pool=await connectDatabase(database.href);
let holdMutation=false;
const originalConnect=pool.connect.bind(pool);
pool.connect=async function(...args){
  if(args.length)return originalConnect(...args);
  const client=await originalConnect();
  if(!client.recoveryHook){
    client.recoveryHook=true;const query=client.query.bind(client);
    client.query=async(...parameters)=>{
      const result=await query(...parameters);
      if(holdMutation&&typeof parameters[0]==='string'&&parameters[0].startsWith('UPDATE rides SET status=')){
        holdMutation=false;process.send({type:'mutation-written'});await query('SELECT pg_sleep(30)');
      }
      return result;
    };
  }
  return client;
};
const maps={route:async()=>({distanceMeters:1200,durationSeconds:240,encodedPolyline:'fixture-only',fareCents:740})};
const service=mobilityService(pool,maps,{inviteCode:'recovery-invite-fixture-only'});
const server=createApi({pool,maps,service,rateLimit:1000});
let drop;
process.on('message',message=>{
  if(message.type==='arm'){drop=message.path;process.send({type:'armed'});}
  if(message.type==='hold-mutation'){holdMutation=true;process.send({type:'armed'});}
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
