import http from "node:http";

const PORT = Number(process.env.PORT || 8080);
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || "";
const allowedOrigin = process.env.CORS_ORIGIN || "";
const base = "https://places.googleapis.com/v1";

function reply(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": allowedOrigin || "null",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(data));
}
async function bodyJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20_000) throw new Error("Requisição excede 20 KB");
  }
  return JSON.parse(body || "{}");
}
async function google(url, payload, fieldMask) {
  if (!GOOGLE_API_KEY) return { error: "GOOGLE_MAPS_SERVER_KEY não configurada", status: 503 };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": fieldMask
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const json = await response.json();
    return response.ok ? { data: json } : { error: json.error?.message || "Erro Google Maps", status: response.status };
  } finally { clearTimeout(timeout); }
}
function position(value) {
  if (!value || !Number.isFinite(value.lat) || !Number.isFinite(value.lng) ||
    Math.abs(value.lat) > 90 || Math.abs(value.lng) > 180) return null;
  return { latitude: value.lat, longitude: value.lng };
}
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return reply(res, 204, {});
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    return reply(res, 200, { service: "namma-yatri-br", status: "ok", mapsConfigured: Boolean(GOOGLE_API_KEY) });
  }
  try {
    if (req.method === "POST" && url.pathname === "/v1/places/autocomplete") {
      const { input, location } = await bodyJson(req);
      if (typeof input !== "string" || input.trim().length < 3 || input.length > 150) return reply(res, 400, { error: "Digite pelo menos 3 caracteres" });
      const payload = { input, languageCode: "pt-BR", regionCode: "BR" };
      const pos = position(location);
      if (pos) payload.locationBias = { circle: { center: pos, radius: 15000 } };
      const out = await google(base + "/places:autocomplete", payload, "suggestions.placePrediction.placeId,suggestions.placePrediction.text");
      if (out.error) return reply(res, out.status, { error: out.error });
      return reply(res, 200, { suggestions: (out.data.suggestions || []).map(x => ({ placeId: x.placePrediction?.placeId, address: x.placePrediction?.text?.text })).filter(x => x.placeId) });
    }
    if (req.method === "POST" && url.pathname === "/v1/places/details") {
      const { placeId } = await bodyJson(req);
      if (typeof placeId !== "string" || !/^[\w:-]{3,255}$/.test(placeId)) return reply(res, 400, { error: "placeId inválido" });
      if (!GOOGLE_API_KEY) return reply(res, 503, { error: "GOOGLE_MAPS_SERVER_KEY não configurada" });
      const result = await fetch(base + "/places/" + encodeURIComponent(placeId) + "?languageCode=pt-BR", { headers: { "X-Goog-Api-Key": GOOGLE_API_KEY, "X-Goog-FieldMask": "id,formattedAddress,location" } });
      const data = await result.json();
      if (!result.ok) return reply(res, result.status, { error: data.error?.message || "Falha ao consultar endereço" });
      return reply(res, 200, { placeId: data.id, address: data.formattedAddress, location: { lat: data.location.latitude, lng: data.location.longitude } });
    }
    if (req.method === "POST" && url.pathname === "/v1/routes") {
      const { origin, destination } = await bodyJson(req);
      const from = position(origin), to = position(destination);
      if (!from || !to) return reply(res, 400, { error: "Origem ou destino inválido" });
      const out = await google("https://routes.googleapis.com/directions/v2:computeRoutes", {
        origin: { location: { latLng: from } },
        destination: { location: { latLng: to } },
        travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE",
        languageCode: "pt-BR", units: "METRIC"
      }, "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline");
      if (out.error) return reply(res, out.status, { error: out.error });
      return reply(res, 200, { routes: (out.data.routes || []).map(x => ({ distanceMeters: x.distanceMeters, duration: x.duration, encodedPolyline: x.polyline?.encodedPolyline })) });
    }
    return reply(res, 404, { error: "Rota não encontrada" });
  } catch (e) {
    return reply(res, 500, { error: e.name === "AbortError" ? "Tempo limite da API de mapas" : "Erro ao processar a solicitação" });
  }
});
server.listen(PORT, "0.0.0.0", () => console.log("Mobilidade BR API em porta " + PORT));

