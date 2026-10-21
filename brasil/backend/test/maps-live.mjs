// Optional provider verification. Uses real Google APIs and never creates a ride.
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { mapsService } from '../src/maps.mjs';
const evidence = { provider: 'Google Places (New) + Routes', checkedAt: new Date().toISOString() };
if (!process.env.GOOGLE_MAPS_SERVER_KEY) {
  evidence.status = 'not_configured';
  console.log('GOOGLE_MAPS_SERVER_KEY ausente: teste Google real NÃO executado.');
} else {
  try {
    const maps = mapsService({ key: process.env.GOOGLE_MAPS_SERVER_KEY });
    const places = await maps.autocomplete('Avenida Paulista, São Paulo');
    assert.ok(places.suggestions.length > 0, 'Google não retornou sugestões');
    const place = await maps.details(places.suggestions[0].placeId);
    assert.ok(Number.isFinite(place.location.lat) && Number.isFinite(place.location.lng));
    const route = await maps.route({ lat: -23.55052, lng: -46.633308 }, { lat: -23.561684, lng: -46.655981 });
    assert.ok(route.distanceMeters > 0 && route.durationSeconds > 0 && route.encodedPolyline.length > 0);
    Object.assign(evidence, { status: 'passed', suggestions: places.suggestions.length, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds });
    console.log('Google real: autocomplete, details e rota verificados.');
  } catch (e) {
    evidence.status = 'failed'; evidence.error = e.message;
    process.exitCode = 1; console.error('Google real: falha na verificação:', e.message);
  }
}
await writeFile('google-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
