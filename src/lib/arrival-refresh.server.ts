import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { freshArrivalLocation } from './arrival';
import { calculateArrival } from './arrival-route.server';

type Order = Pick<Database['public']['Tables']['orders']['Row'], 'id' | 'status' | 'source' | 'released' | 'assigned_driver_id' | 'pickup_departed_at' | 'driver_arrived_at' | 'pickup_lat' | 'pickup_lng' | 'arrival_eta_minutes' | 'arrival_eta_updated_at' | 'arrival_eta_driver_id'>;
type Location = { lat: number | null; lng: number | null; updated_at: string | null };

// Called only after assigned-driver authorization or successful ride-code lookup.
export async function refreshCustomerArrival(db: SupabaseClient<Database>, order: Order, location: Location | null) {
  if (order.source !== 'customer' || !order.released || !order.assigned_driver_id || !order.pickup_departed_at
    || order.driver_arrived_at || !['assigned', 'accepted'].includes(order.status)) return { warning: null };
  if (location?.lat == null || location.lng == null || !freshArrivalLocation(location.updated_at)
    || order.pickup_lat == null || order.pickup_lng == null) {
    return { warning: 'Čekáme na aktuální polohu nebo místo vyzvednutí pro výpočet dojezdu.' };
  }
  const now = Date.now();
  const claimedAt = new Date(now).toISOString();
  const { data: claimed, error } = await db.from('orders')
    .update({ arrival_eta_updated_at: claimedAt, arrival_eta_driver_id: order.assigned_driver_id })
    .eq('id', order.id).eq('assigned_driver_id', order.assigned_driver_id).eq('released', true)
    .eq('pickup_departed_at', order.pickup_departed_at).in('status', ['assigned', 'accepted']).is('driver_arrived_at', null)
    .or(`arrival_eta_updated_at.is.null,arrival_eta_updated_at.lt.${new Date(now - 60000).toISOString()}`)
    .select('id');
  if (error) return { warning: 'Nepodařilo se připravit výpočet dojezdu.' };
  if (!claimed?.length) return { warning: null };
  try {
    const minutes = await calculateArrival({ lat: location.lat, lng: location.lng }, { lat: order.pickup_lat, lng: order.pickup_lng });
    const { data: saved, error: failure } = await db.from('orders')
      .update({ arrival_eta_minutes: minutes, arrival_eta_approx: false })
      .eq('id', order.id).eq('arrival_eta_updated_at', claimedAt).eq('assigned_driver_id', order.assigned_driver_id)
      .eq('arrival_eta_driver_id', order.assigned_driver_id).eq('pickup_departed_at', order.pickup_departed_at)
      .eq('released', true).in('status', ['assigned', 'accepted']).is('driver_arrived_at', null)
      .select('arrival_eta_minutes,arrival_eta_updated_at,arrival_eta_driver_id');
    if (failure) throw new Error('Nepodařilo se uložit vypočtený dojezd.');
    const eta = saved?.[0];
    if (eta) Object.assign(order, eta);
    return { warning: null };
  } catch (error) {
    return { warning: error instanceof Error ? error.message : 'Dojezd se nepodařilo spočítat.' };
  }
}