import { test } from 'node:test';
import assert from 'node:assert/strict';
import { position, point, transition, fare, passwordHash, verifyPassword, tokenHash } from '../src/domain.mjs';
import { mapsService } from '../src/maps.mjs';
import { readBody } from '../src/http.mjs';
import { Readable } from 'node:stream';
test('coordenadas inválidas são rejeitadas, incluindo strings e NaN', () => {
  for (const p of [null, {}, { lat: '0', lng: 0 }, { lat: NaN, lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }]) assert.throws(() => position(p), { status: 400 });
  assert.deepEqual(position({ lat: 0, lng: 0 }), { lat: 0, lng: 0 });
  assert.throws(() => point({ lat: 0, lng: 0, address: '' }), { status: 400 });
});
const driver = { id: 'd', role: 'driver' }, passenger = { id: 'p', role: 'passenger' };
const ride = status => ({ driver_id: 'd', passenger_id: 'p', status });
test('máquina de estados exige chegada antes do início e início antes de concluir', () => {
  assert.equal(transition(ride('accepted'), driver, 'arrive'), 'arrived');
  assert.equal(transition(ride('arrived'), driver, 'start'), 'in_progress');
  assert.equal(transition(ride('in_progress'), driver, 'complete'), 'completed');
  assert.throws(() => transition(ride('accepted'), driver, 'start'), { status: 409 });
  assert.throws(() => transition(ride('accepted'), driver, 'complete'), { status: 409 });
  assert.throws(() => transition(ride('completed'), driver, 'arrive'), { status: 409 });
});
test('passageiro e terceiros não podem executar ações do motorista', () => {
  assert.throws(() => transition(ride('arrived'), passenger, 'start'), { status: 403 });
  assert.throws(() => transition(ride('accepted'), { id: 'x', role: 'driver' }, 'arrive'), { status: 403 });
  assert.equal(transition(ride('searching'), passenger, 'cancel'), 'cancelled');
  assert.throws(() => transition(ride('in_progress'), passenger, 'cancel'), { status: 409 });
});
test('tarifa usa centavos configuráveis e arredonda', () => {
  assert.equal(fare(1234, 500, 200), 747);
  assert.throws(() => fare(1000, -1, 200), { status: 500 });
});
test('senhas possuem sal e verificação; token é armazenado por hash', async () => {
  const hash = await passwordHash('senha-de-teste-123');
  assert.equal(await verifyPassword('senha-de-teste-123', hash), true);
  assert.equal(await verifyPassword('outra-senha-123', hash), false);
  assert.notEqual(hash, await passwordHash('senha-de-teste-123'));
  assert.equal(tokenHash('token').length, 64);
});
test('JSON malformado e corpo excessivo retornam erros de cliente', async () => {
  await assert.rejects(readBody(Readable.from([Buffer.from('{bad') ])), { status: 400 });
  await assert.rejects(readBody(Readable.from([Buffer.alloc(20001)])), { status: 413 });
});
test('ausência de chave impede chamadas Google e nunca inventa rota', async () => {
  const maps = mapsService({ fetchImpl: () => { throw Error('não deveria chamar'); } });
  await assert.rejects(maps.route({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }), { status: 503 });
});
test('Places restringe ao Brasil e usa pt-BR; sugestões vazias permanecem vazias', async () => {
  const maps = mapsService({ key: 'test-only', fetchImpl: async (url, request) => {
    assert.equal(new URL(url).hostname, 'places.googleapis.com');
    const body = JSON.parse(request.body);
    assert.deepEqual(body.includedRegionCodes, ['br']); assert.equal(body.languageCode, 'pt-BR');
    return { ok: true, json: async () => ({ suggestions: [] }) };
  } });
  assert.deepEqual(await maps.autocomplete('Rua Brasil'), { suggestions: [] });
});
test('Google indisponível e rota ausente são erros explícitos', async () => {
  const a = { lat: -23.5, lng: -46.6 }, b = { lat: -23.6, lng: -46.7 };
  await assert.rejects(mapsService({ key: 'test', fetchImpl: async () => ({ ok: false }) }).route(a, b), { status: 502 });
  await assert.rejects(mapsService({ key: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ routes: [] }) }) }).route(a, b), { status: 422 });
});
test('Routes solicita polyline, distância e tempo; converte resposta real do contrato', async () => {
  const maps = mapsService({ key: 'test', fetchImpl: async (_url, req) => {
    assert.match(req.headers['X-Goog-FieldMask'], /encodedPolyline/);
    assert.equal(JSON.parse(req.body).travelMode, 'DRIVE');
    return { ok: true, json: async () => ({ routes: [{ distanceMeters: 1000, duration: '120s', polyline: { encodedPolyline: 'test-fixture' } }] }) };
  } });
  assert.deepEqual(await maps.route({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }), { distanceMeters: 1000, durationSeconds: 120, encodedPolyline: 'test-fixture', fareCents: 700 });
});
