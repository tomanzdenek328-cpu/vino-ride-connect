import { createParser } from 'eventsource-parser';
import { supabase } from '@/integrations/supabase/client';
import type { TranslatorVoice } from './translator-settings';

export async function voiceHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Přihlaste se znovu.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function checkResponse(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error?.message || `Hlasová funkce není dostupná (${response.status}).`);
  }
  if (!response.body) throw new Error('Chybí hlasová odpověď.');
  return response.body;
}

async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (data: string) => void) {
  const parser = createParser({ onEvent: event => { if (event.data !== '[DONE]') onEvent(event.data); } });
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parser.feed(decoder.decode(chunk.value, { stream: true }));
    }
    parser.feed(decoder.decode());
    parser.reset({ consume: true });
  } finally { reader.releaseLock(); }
}

export async function transcribeTranslation(file: File, signal: AbortSignal, onText: (text: string) => void) {
  const form = new FormData(); form.append('file', file);
  const body = await checkResponse(await fetch('/api/public/translator-transcribe', {
    method: 'POST', headers: await voiceHeaders(), body: form, signal,
  }));
  let transcript = ''; let completed = false;
  await readEvents(body, raw => {
    const value = JSON.parse(raw);
    if (value.error || value.type === 'error') throw new Error(value.error?.message || value.message || 'Přepis se nezdařil.');
    if (value.type === 'transcript.text.delta') { transcript += value.delta; onText(transcript); }
    if (value.type === 'transcript.text.done') { transcript = value.text; completed = true; onText(transcript); }
  });
  if (!completed || !transcript.trim()) throw new Error('Nahrávka neobsahuje úplný přepis řeči.');
}

export function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending); bytes.set(incoming, pending.length);
  const usable = bytes.length - bytes.length % 2;
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

export async function playTranslation(text: string, context: AudioContext, signal: AbortSignal, voice: TranslatorVoice, cached?: Float32Array[]) {
  const sources = new Set<AudioBufferSourceNode>();
  const chunks: Float32Array[] = [];
  let playhead = 0; let pending = new Uint8Array(0); let completed = false;
  let playback: Promise<void> = Promise.resolve();
  const abort = () => { for (const source of sources) source.stop(); };
  signal.addEventListener('abort', abort, { once: true });
  const schedule = (samples: Float32Array) => {
    if (!samples.length) return;
    chunks.push(samples);
    const buffer = context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(new Float32Array(samples), 0);
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
    sources.add(source);
    playback = new Promise(resolve => { source.onended = () => { sources.delete(source); resolve(); }; });
    playhead = Math.max(playhead, context.currentTime + 0.05);
    source.start(playhead); playhead += buffer.duration;
  };
  try {
    signal.throwIfAborted();
    if (cached) { cached.forEach(schedule); completed = true; }
    else {
      const body = await checkResponse(await fetch('/api/public/translator-speech', {
        method: 'POST', headers: { ...await voiceHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }), signal,
      }));
      await readEvents(body, raw => {
        const value = JSON.parse(raw);
        if (value.error || value.type === 'error') throw new Error(value.error?.message || value.message || 'Přehrání se nezdařilo.');
        if (value.type === 'speech.audio.done') { completed = true; return; }
        if (value.type !== 'speech.audio.delta') return;
        if (completed || !value.audio) throw new Error('Neplatná hlasová odpověď.');
        const decoded = decodePCM(pending, Uint8Array.from(atob(value.audio), c => c.charCodeAt(0)));
        pending = new Uint8Array(decoded.pending); schedule(decoded.samples);
      });
    }
    if (!completed || !chunks.length || pending.length) throw new Error('Hlasová odpověď není úplná.');
    await playback; signal.throwIfAborted();
    return chunks;
  } finally {
    signal.removeEventListener('abort', abort);
    for (const source of sources) source.stop();
    await context.close();
  }
}