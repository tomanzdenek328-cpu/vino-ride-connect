import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { canManageArrival, hasPreviousRide } from './arrival';
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
      const { data: saved, error: failure } = await query.select('*');
      if (failure || !saved?.length) throw new Error('Příjezd se nepodařilo uložit. Obnovte zakázku.');
      const persisted = saved[0];
      if (persisted) Object.assign(order, persisted);
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
    const { refreshCustomerArrival } = await import('./arrival-refresh.server');
    const result = await refreshCustomerArrival(db, order, location);
    return { ok: true, warning: result.warning };
  });