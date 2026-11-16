import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { canManageArrival, freshArrivalLocation, hasPreviousRide } from './arrival';
import type { Database } from '@/integrations/supabase/types';

export const updateArrival = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), action: z.enum(['manual', 'depart', 'refresh']), minutes: z.number().int().min(1).max(1440).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: driver } = await db.rpc('has_role', { _user_id: context.userId, _role: 'driver' });
    if (!driver) throw new Error('Tuto akci může provést pouze řidič.');
    const { data: order, error } = await db.from('orders').select('*').eq('id', data.id).maybeSingle();
    if (error || !order || !canManageArrival(order, context.userId)) throw new Error('Zakázka není dostupná pro změnu příjezdu.');
    const now = Date.now();
    const save = async (values: Database['public']['Tables']['orders']['Update']) => {
      let query = db.from('orders').update(values).eq('id', order.id).in('status', ['assigned', 'accepted']).eq('released', true).is('driver_arrived_at', null);
      query = order.assigned_driver_id ? query.eq('assigned_driver_id', order.assigned_driver_id) : query.is('assigned_driver_id', null);
      const { data: saved, error: failure } = await query.select('id');
      if (failure || !saved?.length) throw new Error('Příjezd se nepodařilo uložit. Obnovte zakázku.');
    };
    if (data.action === 'manual') {
      if (!data.minutes) throw new Error('Zadejte přibližný počet minut.');
      await save({ manual_arrival_at: new Date(now + data.minutes * 60000).toISOString(), pickup_departed_at: null, arrival_eta_minutes: null, arrival_eta_updated_at: null, arrival_eta_driver_id: null });
      return { ok: true, warning: null };
    }
    const { data: active, error: activeError } = await db.from('orders').select('id,status,assigned_driver_id,assigned_driver_ids,source,released').eq('status', 'in_progress');
    if (activeError) throw new Error('Nelze ověřit předchozí jízdu.');
    if (hasPreviousRide(active ?? [], order.id, context.userId)) throw new Error('Nejprve dokončete předchozí jízdu.');
    if (data.action === 'depart' && !order.pickup_departed_at) {
      await save({ pickup_departed_at: new Date(now).toISOString(), manual_arrival_at: null, status: 'accepted', arrival_eta_minutes: null, arrival_eta_updated_at: null, arrival_eta_driver_id: context.userId });
    } else if (data.action === 'refresh' && !order.pickup_departed_at) {
      return { ok: true, warning: null };
    }
    const { data: location } = await db.from('driver_locations').select('lat,lng,updated_at').eq('driver_id', context.userId).maybeSingle();
    if (location?.lat == null || location.lng == null || !freshArrivalLocation(location.updated_at) || order.pickup_lat == null || order.pickup_lng == null) {
      return { ok: true, warning: 'Čekáme na aktuální polohu nebo místo vyzvednutí pro výpočet dojezdu.' };
    }
    // Claim one calculation per order/minute durably; all customer viewers share the result.
    let claim = db.from('orders').update({ arrival_eta_updated_at: new Date(now).toISOString(), arrival_eta_minutes: null, arrival_eta_driver_id: context.userId })
      .eq('id', order.id).not('pickup_departed_at', 'is', null).in('status', ['assigned', 'accepted']).is('driver_arrived_at', null);
    claim = order.assigned_driver_id ? claim.eq('assigned_driver_id', order.assigned_driver_id) : claim.is('assigned_driver_id', null);
    claim = claim.or(`arrival_eta_updated_at.is.null,arrival_eta_updated_at.lt.${new Date(now - 60000).toISOString()}`);
    const { data: claimed, error: claimError } = await claim.select('id');
    if (claimError) throw new Error('Nepodařilo se připravit výpočet dojezdu.');
    if (!claimed?.length) return { ok: true, warning: null };
    try {
      const { calculateArrival } = await import('./arrival-route.server');
      const minutes = await calculateArrival({ lat: location.lat, lng: location.lng }, { lat: order.pickup_lat, lng: order.pickup_lng });
      const { error: saveError } = await db.from('orders').update({ arrival_eta_minutes: minutes, arrival_eta_approx: false }).eq('id', order.id).eq('arrival_eta_updated_at', new Date(now).toISOString()).eq('arrival_eta_driver_id', context.userId).not('pickup_departed_at', 'is', null);
      if (saveError) throw new Error('Nepodařilo se uložit vypočtený dojezd.');
      return { ok: true, warning: null };
    } catch (error) {
      return { ok: true, warning: error instanceof Error ? error.message : 'Dojezd se nepodařilo spočítat.' };
    }
  });