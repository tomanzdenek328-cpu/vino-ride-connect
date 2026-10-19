import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Users, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recommendDrivers } from '@/lib/dispatch.functions';
export function DriverSuggestions({pickup,passengers,vehicleType}:{pickup:{lat:number;lng:number}|null;passengers:number;vehicleType:string|null}) {
  const run=useServerFn(recommendDrivers);const [result,setResult]=useState<Awaited<ReturnType<typeof recommendDrivers>>|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [sameType,setSameType]=useState(false);
  const load=async()=>{setBusy(true);setError('');setResult(null);try{setResult(await run({data:{pickup,passengers,vehicleType:sameType?vehicleType:null}}));}catch(e){setError(e instanceof Error?e.message:'Řidiče se nepodařilo načíst.');}finally{setBusy(false);}};
  return <section className="space-y-2 border-b border-primary/40 py-3"><div className="flex items-center justify-between gap-2"><h4 className="text-xs text-primary">KOLEGOVÉ PRO SKUPINU</h4><Button type="button" size="sm" variant="outline" disabled={busy} onClick={load}>{busy?<Loader2 className="animate-spin"/>:result?<RefreshCw/>:<Users/>}NAJÍT</Button></div>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={sameType} onChange={e=>{setSameType(e.target.checked);setResult(null);}}/>Pouze zvolený typ auta</label>
    {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
    {result&&<><p className="text-xs text-primary">{result.seats} míst pro {passengers} osob{result.shortfall>0?` · chybí ${result.shortfall} míst`:''}</p>{!pickup&&<p className="text-xs text-amber-warn">Bez souřadnic vyzvednutí nelze určit nejbližšího řidiče.</p>}
    {result.candidates.length===0&&<p className="text-xs text-muted-foreground">Žádný vhodný volný řidič.</p>}
    <ul className="space-y-2">{result.candidates.map(c=><li key={c.id} className="text-xs border-b border-border pb-2"><span className={result.selectedIds.includes(c.id)?'text-primary font-bold':'text-foreground'}>{result.selectedIds.includes(c.id)?'✓ ':''}{c.name}</span> · {c.vehicleType} · {c.capacity} míst<br/><span className="text-muted-foreground">{c.plate} · {c.distance==null?'Poloha neznámá nebo neaktuální':`${c.distance.toFixed(1)} km vzdušnou čarou`}</span></li>)}</ul></>}
  </section>;
}
