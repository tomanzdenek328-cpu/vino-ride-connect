import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { X, Sparkles, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { askDispatcherAssistant } from '@/lib/dispatch.functions';
export function DispatcherAssistant({onClose}:{onClose:()=>void}) {
  const ask=useServerFn(askDispatcherAssistant);const [question,setQuestion]=useState('');const [answer,setAnswer]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const run=async(value=question)=>{if(!value.trim())return;setQuestion(value);setBusy(true);setError('');setAnswer('');try{const result=await ask({data:{question:value}});setAnswer(result.answer);}catch(e){setError(e instanceof Error?e.message:'Pomocník není dostupný.');}finally{setBusy(false);}};
  return <div className="fixed inset-0 z-[2000] bg-background/95 flex items-start justify-center p-4 overflow-y-auto"><section role="dialog" aria-label="Pomocník dispečera" className="w-full max-w-lg bg-background border border-primary p-4 space-y-4 my-4"><div className="flex justify-between items-center gap-2"><h2 className="text-primary flex items-center gap-2"><Sparkles/>POMOCNÍK DISPEČERA</h2><Button variant="ghost" size="icon" aria-label="Zavřít pomocníka" onClick={onClose}><X/></Button></div>
    <div className="flex flex-wrap gap-2">{['Shrň aktuální zakázky.','Kdo je teď volný?','Na co si mám dát pozor?'].map(q=><Button key={q} variant="outline" size="sm" disabled={busy} onClick={()=>run(q)}>{q}</Button>)}</div>
    <form onSubmit={e=>{e.preventDefault();void run();}} className="space-y-2"><textarea aria-label="Dotaz pro pomocníka" rows={3} maxLength={2000} value={question} onChange={e=>setQuestion(e.target.value)} className="w-full border border-primary/40 bg-input p-3 text-sm" placeholder="Váš dotaz…"/><Button disabled={busy||!question.trim()} type="submit">{busy?<Loader2 className="animate-spin"/>:<Send/>}{busy?'ZPRACOVÁVÁM…':'ZEPTAT SE'}</Button></form>
    {error&&<p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}{answer&&<div className="text-sm whitespace-pre-wrap leading-relaxed border-t border-border pt-4">{answer}</div>}
  </section></div>;
}
