import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { assertDispatcher } from '../dispatch/context.server';
import { transcribe } from './transcribe.server';
import { getLovableAiGatewayResponseHeaders } from './run-id.ts';
export async function uploadSpeech(request: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const aiKey = process.env.LOVABLE_API_KEY;
  if (!url || !key || !aiKey) return Response.json({message:'Hlasové zadávání není nakonfigurováno.'},{status:503});
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return Response.json({message:'Přihlaste se znovu.'},{status:401});
  const client = createClient<Database>(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error} = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user) return Response.json({message:'Přihlaste se znovu.'},{status:401});
  try { await assertDispatcher(client,data.user.id); } catch { return Response.json({message:'Hlasové zadávání je pouze pro dispečera.'},{status:403}); }
  const limit = 24 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > limit) return Response.json({message:'Nahrávka je příliš velká.'},{status:413});
  if (!request.body) return Response.json({message:'Chybí nahrávka.'},{status:400});
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size=0;
  while (true) { const chunk = await reader.read(); if (chunk.done) break; size+=chunk.value.byteLength; if (size>limit) {await reader.cancel(); return Response.json({message:'Nahrávka je příliš velká.'},{status:413});} chunks.push(chunk.value); }
  const bytes = new Uint8Array(size); let offset=0; for (const c of chunks) {bytes.set(c,offset);offset+=c.length;}
  try {
    const form = await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type') ?? ''}}).formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size < 2048 || file.type !== 'audio/wav') return Response.json({message:'Nahrajte platnou zvukovou nahrávku WAV.'},{status:400});
    const upstream = await transcribe({baseURL:'https://ai.gateway.lovable.dev',apiKey:aiKey,model:'openai/gpt-transcribe',maxFileBytes:limit,audioOnly:true},file,{signal:request.signal});
    return new Response(upstream.body,{status:upstream.status,headers:getLovableAiGatewayResponseHeaders(upstream.headers,{'Content-Type':upstream.headers.get('content-type') ?? 'text/event-stream','Cache-Control':'no-store'})});
  } catch (error) {
    if (request.signal.aborted) return new Response(null,{status:499});
    return Response.json({message:error instanceof Error ? error.message : 'Hlasový přepis se nezdařil.'},{status:400});
  }
}
