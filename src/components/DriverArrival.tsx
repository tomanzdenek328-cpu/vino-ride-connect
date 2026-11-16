import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Clock, Navigation, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateArrival } from '@/lib/arrival.functions';

export function DriverArrival({ id, manualAt, departedAt, previousRide, onSaved }: {
  id: string; manualAt?: string | null; departedAt?: string | null; previousRide: boolean;
  onSaved: (values: { manual_arrival_at: string | null; pickup_departed_at: string | null; status?: string }) => void;
}) {
  const update = useServerFn(updateArrival);
  const [minutes, setMinutes] = useState('25');
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const running = useRef(false);
  const paused = useRef(false);
  useEffect(() => {
    if (!departedAt) return;
    let stopped = false;
    const refresh = async () => {
      if (running.current || paused.current || document.visibilityState === 'hidden') return;
      running.current = true;
      try {
        const result = await update({ data: { id, action: 'refresh' } });
        if (!stopped) setWarning(result.warning);
        if (result.warning && !result.warning.startsWith('Čekáme')) paused.current = true;
      } catch { paused.current = true; }
      finally { running.current = false; }
    };
    const timer = window.setInterval(refresh, 60000);
    const resume = () => { void refresh(); };
    document.addEventListener('visibilitychange', resume);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, [departedAt, id, update]);

  const submit = async (action: 'manual' | 'depart') => {
    if (busy || running.current) return;
    const value = Number(minutes);
    if (action === 'manual' && (!Number.isInteger(value) || value < 1 || value > 1440)) { toast.error('Zadejte počet minut od 1 do 1440.'); return; }
    setBusy(true);
    paused.current = false;
    try {
      const result = await update({ data: { id, action, ...(action === 'manual' ? { minutes: value } : {}) } });
      const now = Date.now();
      onSaved(action === 'manual' ? { manual_arrival_at: new Date(now + value * 60000).toISOString(), pickup_departed_at: null } : { manual_arrival_at: null, pickup_departed_at: new Date(now).toISOString(), status: 'accepted' });
      setWarning(result.warning);
      if (result.warning && !result.warning.startsWith('Čekáme')) paused.current = true;
      toast.success(action === 'manual' ? 'Odhad příjezdu odeslán zákazníkovi.' : 'Zákazník vidí, že jedete k němu.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Příjezd se nepodařilo uložit.'); }
    finally { setBusy(false); }
  };

  return <div className="mt-3 space-y-2 border-t border-customer-order/40 pt-3">
    {!departedAt && <>
      <label htmlFor={`arrival-${id}`} className="flex items-center gap-2 text-xs text-foreground"><Clock className="h-4 w-4" /> PŘIBLIŽNÝ PŘÍJEZD ZA (MIN)</label>
      <div className="flex gap-2">
        <Input id={`arrival-${id}`} aria-label="Přibližný příjezd v minutách" type="number" min={1} max={1440} value={minutes} onChange={event => setMinutes(event.target.value)} className="w-24 shrink-0" disabled={busy} />
        <Button variant="outline" className="min-w-0 flex-1 whitespace-normal text-xs" disabled={busy} onClick={() => submit('manual')}><Save /> ULOŽIT ODHAD</Button>
      </div>
      {manualAt && <div className="text-xs text-customer-order">Odhad příjezdu: {new Date(manualAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</div>}
    </>}
    <Button className="w-full whitespace-normal h-auto min-h-9 py-2 text-xs" disabled={busy || previousRide} onClick={() => submit('depart')}><Navigation />{departedAt ? 'OBNOVIT DOJÍŽDĚNÍ K ZÁKAZNÍKOVI' : 'JEDU PRO ZÁKAZNÍKA'}</Button>
    {previousRide && <div className="text-xs text-amber-warn">Nejdříve dokončete předchozí jízdu.</div>}
    {departedAt && <div className="text-xs text-primary">✓ NA CESTĚ K ZÁKAZNÍKOVI</div>}
    {warning && <div role="status" className="text-xs text-amber-warn">{warning}</div>}
  </div>;
}