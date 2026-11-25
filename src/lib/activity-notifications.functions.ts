import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { activityRecipients } from './notification-audience';

export const notifyActivity = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ kind: z.enum(['chat', 'sos']), id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [driver, dispatcher] = await Promise.all([
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'driver' }),
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'dispatcher' }),
    ]);
    if (driver.error || dispatcher.error || (!driver.data && !dispatcher.data)) throw new Error('Forbidden');
    // Caller must have authored the persisted event and still be allowed to read it.
    const chat = data.kind === 'chat'
      ? await context.supabase.from('chat_messages').select('sender_id,participants,thread_key,created_at').eq('id', data.id).maybeSingle()
      : null;
    const sos = data.kind === 'sos'
      ? await context.supabase.from('sos_alerts').select('driver_id,resolved_at,created_at').eq('id', data.id).maybeSingle()
      : null;
    const event = chat?.data ?? sos?.data;
    if (!event || (chat && (chat.error || chat.data?.sender_id !== context.userId)) ||
      (sos && (sos.error || sos.data?.driver_id !== context.userId || sos.data?.resolved_at))) throw new Error('Forbidden');
    // This endpoint sends a newly-created event, never replays an old archive entry.
    if (Date.now() - Date.parse(event.created_at) > 120_000) return { ok: false, sent: 0, fcmSent: 0 };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const [roles, access] = await Promise.all([
      supabaseAdmin.from('user_roles').select('user_id,role').in('role', ['driver', 'dispatcher']),
      supabaseAdmin.from('dispatcher_access').select('user_id').eq('access', 'helper'),
    ]);
    if (roles.error || access.error) throw new Error('Příjemce upozornění se nepodařilo načíst');
    const recipients = activityRecipients(roles.data ?? [], (access.data ?? []).map(row => row.user_id), {
      kind: data.kind, senderId: context.userId,
      ...(chat?.data ? { participants: chat.data.participants, threadKey: chat.data.thread_key } : {}),
    });
    const { sendPushToUsers } = await import('./notify.server');
    // Private message content and driver identity are not exposed on the lock screen.
    const result = await sendPushToUsers(recipients, {
      title: data.kind === 'sos' ? '🚨 SOS – řidič v nouzi' : '✉ Nová zpráva',
      body: data.kind === 'sos' ? 'Otevřete Vinné Taxi a zkontrolujte SOS.' : 'Otevřete zprávy ve Vinném Taxi.',
      tag: `${data.kind}-${data.id}`,
      priority: data.kind === 'sos',
    });
    return { ok: true, ...result };
  });