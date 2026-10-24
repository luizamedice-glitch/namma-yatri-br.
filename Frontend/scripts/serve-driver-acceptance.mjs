// CI-only, isolated PostgreSQL + real API. No Google route fixture, no public listener.
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {connectDatabase} from '../../brasil/backend/src/db.mjs';
import {migrate} from '../../brasil/backend/src/migrate.mjs';
import {developmentAccounts} from '../../brasil/backend/src/development.mjs';
import {mobilityService} from '../../brasil/backend/src/mobility.mjs';
import {createApi} from '../../brasil/backend/src/http.mjs';
const pool = await connectDatabase(process.env.DATABASE_URL);
await migrate(pool);
const passengerKey=randomBytes(32).toString('hex'),driverKey=randomBytes(32).toString('hex');
const development=await developmentAccounts(pool,{enabled:true,passengerKey,driverKey,
  vehicle:{plate:'TST1A23',model:'Veículo de teste automatizado',color:'Prata'}});
const driver=await development.session({role:'driver',credential:driverKey});
const maps={route:async()=>{throw Error('Rotas não utilizadas no aceite de GPS/disponibilidade.');}};
const service=mobilityService(pool,maps,{allowDevelopmentAccounts:true});
const server=createApi({pool,maps,service,development});
await new Promise(resolve=>server.listen(8080,'127.0.0.1',resolve));
await writeFile(process.env.DRIVER_ACCEPTANCE_SESSION_FILE,JSON.stringify({token:driver.token}),{mode:0o600});
console.log('API de aceite isolada pronta; sessão gravada em arquivo privado.');
process.on('SIGTERM',()=>{server.closeStreams();server.closeAllConnections();server.close(()=>pool.end().then(()=>process.exit()));});
