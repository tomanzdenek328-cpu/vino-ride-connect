import { createClient } from '@supabase/supabase-js';
import { requestSpeech } from './speech-request.server';
import { getLovableAiGatewayResponseHeaders } from './run-id';

export async function translatorSpeech(request: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const aiKey = process.env.LOVABLE_API_KEY;
  if (!url || !key || !aiKey) return Response.json({ message: 'Hlas překladače není nakonfigurován.' }, { status: 503 });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return Response.json({ message: 'Přihlaste se znovu.' }, { status: 401 });
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user) return Response.json({ message: 'Přihlaste se znovu.' }, { status: 401 });
  try {
    const input = await request.json();
    if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 6000) {
      return Response.json({ message: 'Text pro přehrání musí mít 1 až 6000 znaků.' }, { status: 400 });
    }
    const upstream = await requestSpeech({ baseURL: 'https://ai.gateway.lovable.dev', apiKey: aiKey,
      model: 'google/gemini-3.1-flash-tts-preview', format: 'gemini', voice: 'Kore' }, input.text, false, request.signal);
    return new Response(upstream.body, { status: upstream.status, headers: getLovableAiGatewayResponseHeaders(upstream.headers, {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream', 'Cache-Control': 'no-store',
    }) });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return Response.json({ message: error instanceof Error ? error.message : 'Přehrání překladu se nezdařilo.' }, { status: 400 });
  }
}