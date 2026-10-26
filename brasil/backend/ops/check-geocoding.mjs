// Read-only check against Google's real Geocoding API using the existing server key.
// Fixed PUBLIC CI coordinate in Sao Paulo; never log URL/key or Google's error_message.
const key=process.env.GOOGLE_MAPS_SERVER_KEY;
if(!key){console.log(JSON.stringify({configured:false,status:'KEY_MISSING'}));process.exit(1);}
try{
 const query=new URLSearchParams({latlng:'-23.5505,-46.6333',language:'pt-BR',key});
 const response=await fetch('https://maps.googleapis.com/maps/api/geocode/json?'+query,{signal:AbortSignal.timeout(12000)});
 const data=await response.json();
 const statuses=['OK','ZERO_RESULTS','REQUEST_DENIED','OVER_DAILY_LIMIT','OVER_QUERY_LIMIT','INVALID_REQUEST','UNKNOWN_ERROR'];
 const status=statuses.includes(data.status)?data.status:'UNEXPECTED_RESPONSE';
 console.log(JSON.stringify({configured:true,http:response.status,status,addressPresent:typeof data.results?.[0]?.formatted_address==='string',coordinatesPresent:!!data.results?.[0]?.geometry?.location}));
 if(status!=='OK')process.exitCode=1;
}catch(_){console.log(JSON.stringify({configured:true,status:'NETWORK_ERROR'}));process.exitCode=1;}
