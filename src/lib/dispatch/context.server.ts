import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { vehicleKey, type Candidate } from './schemas';
export async function assertDispatcher(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.rpc('has_role', { _user_id: userId, _role: 'dispatcher' });
  if (error || !data) throw new Error('Tato funkce je dostupná pouze dispečerovi.');
}
export async function readDispatchContext(client: SupabaseClient<Database>) {
  const [orders, locations, vehicles, tariffs, profiles, roles] = await Promise.all([
    client.from('orders').select('id,pickup_address,destination,scheduled_time,passengers,vehicle_type,status,released,assigned_driver_id,assigned_driver_ids,estimated_price').in('status',['pending','assigned','accepted','in_progress']).order('scheduled_time').limit(200),
    client.from('driver_locations').select('*'), client.from('vehicles').select('id,plate,car_type,active'),
    client.from('tariffs').select('vehicle_type,capacity'), client.from('profiles').select('id,full_name,call_sign'),
    client.from('user_roles').select('user_id').eq('role','driver'),
  ]);
  const error = orders.error || locations.error || vehicles.error || tariffs.error || profiles.error || roles.error;
  if (error) throw new Error('Nepodařilo se načíst aktuální zakázky a řidiče.');
  const ids = new Set((roles.data ?? []).map(r => r.user_id));
  const candidates: Candidate[] = (locations.data ?? []).flatMap(l => {
    const vehicle = vehicles.data?.find(v => v.id === l.vehicle_id && v.active);
    const profile = profiles.data?.find(p => p.id === l.driver_id);
    if (!vehicle || !profile || !ids.has(l.driver_id)) return [];
    const capacity = tariffs.data?.find(t => vehicleKey(t.vehicle_type) === vehicleKey(vehicle.car_type) && vehicleKey(t.vehicle_type) != null)?.capacity ?? 0;
    const assigned = orders.data?.some(o => ['assigned','accepted','in_progress'].includes(o.status) && (o.assigned_driver_id === l.driver_id || o.assigned_driver_ids.includes(l.driver_id)));
    return [{ id:l.driver_id, name: profile.call_sign || profile.full_name, vehicleType:vehicle.car_type, plate:vehicle.plate, capacity, lat:l.lat, lng:l.lng, updatedAt:l.updated_at, online:l.online, busy:l.busy || !!assigned }];
  });
  return { orders: orders.data ?? [], candidates };
}
