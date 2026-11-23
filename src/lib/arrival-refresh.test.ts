import { it } from 'node:test';
import { strict as assert } from 'node:assert';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { refreshCustomerArrival } from './arrival-refresh.server';

it('customer polling calculates road ETA without the driver screen and shares the minute claim', async () => {
  const now = new Date().toISOString();
  const order = { id: 'test', source: 'customer', status: 'accepted' as const, released: true, assigned_driver_id: 'driver', pickup_departed_at: now, driver_arrived_at: null, pickup_lat: 48.7594, pickup_lng: 16.8813, arrival_eta_minutes: null as number | null, arrival_eta_updated_at: null as string | null, arrival_eta_driver_id: null as string | null };
  const stored = { ...order };
  let calls = 0;
  const db = { from: () => {
    let patch: Record<string, unknown> = {};
    let isClaim = false;
    const query = {
      update(values: Record<string, unknown>) { patch = values; return query; },
      eq() { return query; }, in() { return query; }, is() { return query; },
      or() { isClaim = true; return query; },
      async select() {
        if (isClaim && stored.arrival_eta_updated_at && Date.now() - Date.parse(stored.arrival_eta_updated_at) < 60000) return { data: [], error: null };
        Object.assign(stored, patch);
        return { data: [{ ...stored }], error: null };
      },
    };
    return query;
  } } as unknown as SupabaseClient<Database>;
  const originalFetch = globalThis.fetch;
  const originalMaps = process.env['GOOGLE_MAPS_API_KEY'];
  const originalLovable = process.env['LOVABLE_API_KEY'];
  process.env['GOOGLE_MAPS_API_KEY'] = 'test-only';
  process.env['LOVABLE_API_KEY'] = 'test-only';
  globalThis.fetch = (async (_input, init) => {
    calls++;
    const body = JSON.parse(String(init?.body)) as { origin: { location: { latLng: { latitude: number } } } };
    assert.equal(body.origin.location.latLng.latitude, 48.75);
    return Response.json({ routes: [{ duration: '420s' }] });
  }) as typeof fetch;
  try {
    const location = { lat: 48.75, lng: 16.9, updated_at: now };
    await refreshCustomerArrival(db, order, location);
    assert.equal(order.arrival_eta_minutes, 7);
    await refreshCustomerArrival(db, { ...stored }, location);
    assert.equal(calls, 1);
    await refreshCustomerArrival(db, { ...stored, pickup_departed_at: null }, location);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalMaps === undefined) delete process.env['GOOGLE_MAPS_API_KEY']; else process.env['GOOGLE_MAPS_API_KEY'] = originalMaps;
    if (originalLovable === undefined) delete process.env['LOVABLE_API_KEY']; else process.env['LOVABLE_API_KEY'] = originalLovable;
  }
});