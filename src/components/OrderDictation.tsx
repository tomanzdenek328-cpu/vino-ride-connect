import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Mic, Square, Loader2, WandSparkles } from 'lucide-react';
import { createParser } from 'eventsource-parser';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { recordWav } from '@/lib/dispatch/record-wav';
import { parseDictatedOrder } from '@/lib/dispatch.functions';
import type { OrderDraft } from '@/lib/dispatch/schemas';
export function OrderDictation({onApply}:{onApply:(draft:OrderDraft)=>void}) {
  const parse = useServerFn(parseDictatedOrder);
  const recording = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const disposed = useRef(false);
  const [active,setActive]=useState(false); const [busy,setBusy]=useState(false);
  const [text,setText]=useState(''); const [error,setError]=useState('');
  const [warnings,setWarnings]=useState<string[]>([]);
  useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;void recording.current?.stop().catch(()=>{});recording.current=null;}},[]);
  const start = async () => {
    setError('');setBusy(true);
    try {const recorder=await recordWav();if(disposed.current){void recorder.stop().catch(()=>{});return;}recording.current=recorder;setActive(true);} catch {setError('Mikrofon není dostupný. Povolte přístup k mikrofonu nebo napište zakázku.');} finally {setBusy(false);}
  };
  const stop = async () => {
    const recorder=recording.current;if(!recorder)return;recording.current=null;setActive(false);setBusy(true);setError('');
    try {
      const file=await recorder.stop();const {data}=await supabase.auth.getSession();
      if(!data.session)throw new Error('Přihlaste se znovu.');
      const form=new FormData();form.append('file',file);
      const response=await fetch('/api/public/dictation',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`},body:form});
      if(!response.ok){const body=await response.json();throw new Error(body.message || body.error?.message || 'Přepis se nezdařil.');}
      if(!response.body)throw new Error('Chybí hlasový přepis.');
      let transcript='';let complete=false;let streamError='';
      const parser=createParser({onEvent(event){if(event.data==='[DONE]')return;const value=JSON.parse(event.data);if(value.type==='transcript.text.delta'){transcript+=value.delta;setText(transcript);}if(value.type==='transcript.text.done'){transcript=value.text;complete=true;setText(transcript);}if(value.type==='error')streamError=value.error?.message || value.message || 'Přepis se nezdařil.';}});
      const reader=response.body.getReader();const decoder=new TextDecoder();
      while(true){const chunk=await reader.read();if(chunk.done)break;parser.feed(decoder.decode(chunk.value,{stream:true}));}parser.feed(decoder.decode());
      if(streamError)throw new Error(streamError);if(!complete || !transcript.trim())throw new Error('Přepis není úplný. Zkuste nahrát řeč znovu.');
    }catch(e){setError(e instanceof Error?e.message:'Přepis se nezdařil.');}finally{setBusy(false);}
  };
  const fill = async () => {setBusy(true);setError('');try{const draft=await parse({data:{text}});onApply(draft);setWarnings(draft.warnings);}catch(e){setError(e instanceof Error?e.message:'Zakázku se nepodařilo rozpoznat.');}finally{setBusy(false);}};
  return <section className="space-y-2 border-b border-primary/40 pb-3">
    <div className="flex items-center justify-between gap-2"><h4 className="text-xs text-primary">HLASOVÁ ZAKÁZKA</h4><Button type="button" variant={active?'destructive':'outline'} size="sm" disabled={busy} onClick={active?stop:start}>{busy?<Loader2 className="animate-spin"/>:active?<Square/>:<Mic/>}{active?'UKONČIT':'DIKTOVAT'}</Button></div>
    <textarea aria-label="Diktovaná zakázka" value={text} onChange={e=>setText(e.target.value)} maxLength={6000} rows={2} placeholder="Zakázka…" className="w-full border border-primary/40 bg-input p-2 text-sm"/>
    <Button type="button" size="sm" disabled={busy || active || !text.trim()} onClick={fill}><WandSparkles/>VYPLNIT ZAKÁZKU</Button>
    {error && <p role="alert" className="text-xs text-destructive whitespace-pre-wrap">{error}</p>}
    {warnings.map((warning,i)=><p key={i} className="text-xs text-amber-warn">{warning}</p>)}
  </section>;
}
