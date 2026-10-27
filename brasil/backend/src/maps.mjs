import {geoapifyGeocoding} from './geocoding.mjs';
import { ApiError, requireThat, position, text, fare } from './domain.mjs';
export function mapsService({ key, geoapifyKey, baseFareCents = 500, perKmCents = 200, fetchImpl = fetch }) {
  async function google(url, payload, mask) {
    requireThat(key, 503, 'GOOGLE_MAPS_SERVER_KEY não configurada');
    let response;
    try {
      response = await fetchImpl(url, {
        method: payload ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': mask },
        ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new ApiError(502, 'Serviço Google Maps indisponível; verifique chave, quota e restrições');
      return await response.json();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(502, 'Não foi possível consultar Google Maps');
    }
  }
  return {
    reverse:geoapifyGeocoding({key:geoapifyKey,fetchImpl}).reverse,
    async autocomplete(input, location) {
      text(input, 'Busca', 3, 150);
      const payload = { input, languageCode: 'pt-BR', regionCode: 'BR', includedRegionCodes: ['br'] };
      if (location) { const p = position(location); payload.locationBias = { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 15000 } }; }
      const data = await google('https://places.googleapis.com/v1/places:autocomplete', payload, 'suggestions.placePrediction.placeId,suggestions.placePrediction.text');
      return { suggestions: (data.suggestions || []).filter(x => x.placePrediction).map(x => ({ placeId: x.placePrediction.placeId, address: x.placePrediction.text.text })) };
    },
    async details(placeId) {
      requireThat(typeof placeId === 'string' && /^[\w:-]{3,255}$/.test(placeId), 400, 'placeId inválido');
      const data = await google('https://places.googleapis.com/v1/places/' + encodeURIComponent(placeId) + '?languageCode=pt-BR', null, 'id,formattedAddress,location,addressComponents');
      requireThat(data.location, 404, 'Endereço sem coordenadas');
      return { placeId: data.id, address: data.formattedAddress, location: { lat: data.location.latitude, lng: data.location.longitude },
        addressComponents:(data.addressComponents||[]).map(c=>({long_name:c.longText,short_name:c.shortText||c.longText,types:c.types||[]})) }; 
    },
    async route(origin, destination) {
      const waypoint = p => { const v = position(p); return { location: { latLng: { latitude: v.lat, longitude: v.lng } } }; };
      const data = await google('https://routes.googleapis.com/directions/v2:computeRoutes', {
        origin: waypoint(origin), destination: waypoint(destination), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', languageCode: 'pt-BR', units: 'METRIC'
      }, 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline');
      requireThat(data.routes?.length, 422, 'Não foi encontrada uma rota rodoviária');
      const r = data.routes[0];
      const durationSeconds = Number(String(r.duration).replace(/s$/, ''));
      requireThat(Number.isFinite(r.distanceMeters) && r.distanceMeters > 0 && Number.isFinite(durationSeconds) && durationSeconds > 0 && r.polyline?.encodedPolyline, 502, 'Rota incompleta recebida do Google');
      return { distanceMeters: r.distanceMeters, durationSeconds, encodedPolyline: r.polyline.encodedPolyline, fareCents: fare(r.distanceMeters, baseFareCents, perKmCents) };
    }
  };
}
