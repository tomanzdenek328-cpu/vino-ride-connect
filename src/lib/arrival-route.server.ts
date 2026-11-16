export async function calculateArrival(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const key = process.env['GOOGLE_MAPS_API_KEY'];
  const lovable = process.env['LOVABLE_API_KEY'];
  if (!key || !lovable) throw new Error('Výpočet dojezdu není připojen ke Google Mapám.');
  const response = await fetch('https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': key, 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'routes.duration' },
    body: JSON.stringify({ origin: { location: { latLng: { latitude: a.lat, longitude: a.lng } } }, destination: { location: { latLng: { latitude: b.lat, longitude: b.lng } } }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', languageCode: 'cs', regionCode: 'CZ' }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Arrival Maps [${response.status}]: ${body}`);
    if (response.status === 403) throw new Error('Google Mapy odmítly výpočet dojezdu. Je potřeba ověřit povolení Routes API u připojeného účtu.');
    throw new Error(`Výpočet dojezdu Google Map není dostupný (${response.status}).`);
  }
  const result = await response.json() as { routes?: { duration?: string }[] };
  const duration = result.routes?.[0]?.duration;
  if (!duration || !/^\d+(\.\d+)?s$/.test(duration)) throw new Error('Google Mapy nevrátily platnou dobu dojezdu.');
  return Math.max(1, Math.ceil(Number(duration.slice(0, -1)) / 60));
}