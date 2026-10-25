// SPDX-License-Identifier: AGPL-3.0-or-later
// Dedicated driver pilot. Does not seed accounts or expose login/registration.
import {createApi} from './http.mjs';
import {mobilityService} from './mobility.mjs';
import {requireThat} from './domain.mjs';
import {exchangePairing} from './driver-pairing.mjs';

export const driverPilotRoutes = Object.freeze([
  'GET /v1/snapshot', 'POST /v1/driver/location', 'POST /v1/driver/availability', 'POST /v1/driver/pair',
  'POST /v1/passenger/pair','POST /v1/places/reverse','POST /v1/quotes','POST /v1/rides'
]);
export const driverPilotId = 'b1a51100-0000-4000-8000-000000000002';
export const passengerPilotId = 'b1a51100-0000-4000-8000-000000000001';
export function pilotRouteAllowed(method,path){
  return driverPilotRoutes.includes(method+' '+path) ||
    method==='GET' && /^\/v1\/rides\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}(?:\/navigation)?$/.test(path) ||
    method==='POST' && /^\/v1\/rides\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\/(accept|reject|arrive|start|complete|cancel)$/.test(path);
}

export function createDriverPilot({pool, enabled, nodeEnv, until, now = Date.now, maps={} }) {
  if (enabled !== true || nodeEnv === 'production') throw Error('DRIVER_PILOT_DISABLED');
  const expiration = Date.parse(until);
  if (!Number.isFinite(expiration) || expiration <= now() || expiration > now() + 7 * 86400000)
    throw Error('DRIVER_PILOT_WINDOW_INVALID');
  const base = mobilityService(pool, maps, {allowDevelopmentAccounts:true});
  const service = {...base, async authenticate(token) {
    requireThat(now() < expiration, 503, 'Janela de testes do motorista encerrada');
    const user = await base.authenticate(token);
    requireThat(user.role === 'driver' && user.id === driverPilotId || user.role==='passenger' && user.id===passengerPilotId, 403, 'Sessão fora do piloto de mobilidade');
    return user;
  }};
  return createApi({pool, service, maps, allowedRoutes:pilotRouteAllowed, pairing:(body,role)=>{
    requireThat(now()<expiration,503,'Janela de testes do motorista encerrada');
    return exchangePairing(pool,body,role);
  }});
}
