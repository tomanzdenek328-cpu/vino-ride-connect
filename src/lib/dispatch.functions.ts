import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { rankDrivers } from './dispatch/schemas';
export const parseDictatedOrder = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({text:z.string().trim().min(1).max(6000)}).parse(input))
  .handler(async ({data,context}) => {
    const {assertDispatcher} = await import('./dispatch/context.server');
    await assertDispatcher(context.supabase,context.userId);
    const {parseOrder} = await import('./ai/dispatch.server');
    return parseOrder(data.text);
  });
export const recommendDrivers = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({pickup:z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).nullable(),vehicleType:z.string().max(40).nullable(),passengers:z.number().int().min(1).max(30)}).parse(input))
  .handler(async ({data,context}) => {
    const {assertDispatcher,readDispatchContext} = await import('./dispatch/context.server');
    await assertDispatcher(context.supabase,context.userId);
    const state = await readDispatchContext(context.supabase);
    const ranked = rankDrivers(state.candidates,data.pickup,data.vehicleType);
    let seats = 0;
    const selected = ranked.filter(c => {if (seats >= data.passengers) return false; seats += c.capacity; return true;});
    return {candidates:ranked,selectedIds:selected.map(c => c.id),seats,shortfall:Math.max(0,data.passengers-seats)};
  });
export const askDispatcherAssistant = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({question:z.string().trim().min(1).max(2000)}).parse(input))
  .handler(async ({data,context}) => {
    const {assertDispatcher,readDispatchContext} = await import('./dispatch/context.server');
    await assertDispatcher(context.supabase,context.userId);
    const state = await readDispatchContext(context.supabase);
    const {assistDispatcher} = await import('./ai/dispatch.server');
    return {answer:await assistDispatcher(data.question,state)};
  });
