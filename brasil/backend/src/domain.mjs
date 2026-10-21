import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireThat(condition, status, message) {
  if (!condition) throw new ApiError(status, message);
}
export function text(value, name, min = 1, max = 150) {
  requireThat(typeof value === 'string' && value.trim().length >= min && value.length <= max, 400, `${name} inválido`);
  return value.trim();
}
export function position(value) {
  requireThat(value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180, 400, 'Coordenadas inválidas');
  return { lat: value.lat, lng: value.lng };
}
export function point(value) {
  return { ...position(value), address: text(value.address, 'Endereço', 1, 300) };
}
export function uuid(value) {
  requireThat(typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value), 400, 'Identificador inválido');
  return value;
}
export const activeStates = ['searching', 'accepted', 'arrived', 'in_progress'];
export function transition(ride, actor, action) {
  const ownPassenger = ride.passenger_id === actor.id;
  const ownDriver = ride.driver_id === actor.id;
  requireThat(ownPassenger || ownDriver, 403, 'Acesso negado');
  if (action === 'cancel') {
    requireThat(['searching', 'accepted', 'arrived'].includes(ride.status), 409, 'Não é possível cancelar neste estado');
    return 'cancelled';
  }
  requireThat(ownDriver && actor.role === 'driver', 403, 'Somente o motorista atribuído');
  const next = { arrive: ['accepted', 'arrived'], start: ['arrived', 'in_progress'], complete: ['in_progress', 'completed'] }[action];
  requireThat(next && next[0] === ride.status, 409, 'Transição de corrida inválida');
  return next[1];
}
export function fare(distanceMeters, base, perKm) {
  requireThat(Number.isFinite(base) && base >= 0 && Number.isFinite(perKm) && perKm >= 0, 500, 'Tarifa não configurada');
  return Math.round(base + distanceMeters / 1000 * perKm);
}
export function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }
export function newToken() { return randomBytes(32).toString('hex'); }
export async function passwordHash(password) {
  text(password, 'Senha', 10, 128);
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, hash] = encoded.split(':');
  const candidate = await scrypt(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}
