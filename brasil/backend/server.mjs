import { connectDatabase } from './src/db.mjs';
import { mapsService } from './src/maps.mjs';
import { mobilityService } from './src/mobility.mjs';
import { createApi } from './src/http.mjs';
const pool = await connectDatabase(process.env.DATABASE_URL);
const configNumber = (name, fallback) => {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n < 0) throw new Error(name + ' inválido');
  return n;
};
if (!process.env.TEST_INVITE_CODE || process.env.TEST_INVITE_CODE.length < 16) throw new Error('TEST_INVITE_CODE precisa ter ao menos 16 caracteres');
const maps = mapsService({ key: process.env.GOOGLE_MAPS_SERVER_KEY, baseFareCents: configNumber('BASE_FARE_CENTS', 500), perKmCents: configNumber('PER_KM_CENTS', 200) });
const service = mobilityService(pool, maps, { inviteCode: process.env.TEST_INVITE_CODE, radiusMeters: configNumber('DRIVER_RADIUS_METERS', 5000) });
const server = createApi({ service, maps, pool, allowedOrigin: process.env.CORS_ORIGIN });
let dispatching = false;
const timer = setInterval(async () => {
  if (dispatching) return; dispatching = true;
  try { await service.dispatch(); } catch (e) { console.error('Falha na distribuição:', e.code || e.name); }
  finally { dispatching = false; }
}, 3000);
server.listen(Number(process.env.PORT || 8080), process.env.HOST || '127.0.0.1', () => console.log('Mobilidade BR API iniciada'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  clearInterval(timer); server.closeStreams(); server.close(async () => { await pool.end(); process.exit(0); });
});
