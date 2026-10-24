// SPDX-License-Identifier: AGPL-3.0-or-later
import {connectDatabase} from './db.mjs';
import {createDriverPilot} from './driver-pilot.mjs';
import {mapsService} from './maps.mjs';
const pool=await connectDatabase(process.env.DATABASE_URL);
const server=createDriverPilot({pool, enabled:process.env.YATRI_DRIVER_PILOT_MODE==='true',
  nodeEnv:process.env.NODE_ENV, until:process.env.YATRI_DRIVER_PILOT_UNTIL,
  maps:mapsService({key:process.env.GOOGLE_MAPS_SERVER_KEY,baseFareCents:Number(process.env.BASE_FARE_CENTS||500),perKmCents:Number(process.env.PER_KM_CENTS||200)})});
server.listen(Number(process.env.PORT||8082),process.env.HOST||'127.0.0.1',()=>console.log('Driver pilot ready'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
  server.closeStreams();server.close(async()=>{await pool.end();process.exit(0);});
});
