// SPDX-License-Identifier: AGPL-3.0-or-later
// Read-only provider check in the running pilot. Public CI point, no database writes.
// Do not print provider responses, addresses, URLs, keys or exception messages.
try {
  const {geoapifyGeocoding} = await import('/app/src/geocoding.mjs');
  const result = await geoapifyGeocoding({key:process.env.GEOAPIFY_API_KEY})
    .reverse({lat:-23.5505,lng:-46.6333});
  const valid = result.provider === 'geoapify' && result.address.length >= 3
    && Number.isFinite(result.location.lat) && Number.isFinite(result.location.lng)
    && result.attribution.dataUrl === 'https://www.openstreetmap.org/copyright';
  console.log(JSON.stringify({provider:'geoapify',verified:valid,privateKeyConfigured:!!process.env.GEOAPIFY_API_KEY}));
  if (!valid) process.exitCode = 1;
} catch (_) {
  console.log(JSON.stringify({provider:'geoapify',verified:false,privateKeyConfigured:!!process.env.GEOAPIFY_API_KEY}));
  process.exitCode = 1;
}
