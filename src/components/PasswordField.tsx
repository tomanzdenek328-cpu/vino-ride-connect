import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PasswordField({ value, onChange, label = "HESLO", autoComplete = "current-password", minLength }: {
  value: string; onChange: (value: string) => void; label?: string; autoComplete?: string; minLength?: number;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div>
    <label htmlFor={id} className="block text-xs text-muted-foreground mb-1">{label}</label>
    <div className="relative">
      <input id={id} type={visible ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} required
        minLength={minLength} autoComplete={autoComplete}
        className="w-full bg-input border border-primary/40 pl-3 pr-12 py-2 text-primary focus:border-primary focus:outline-none" />
      <Button type="button" variant="ghost" size="icon" aria-label={visible ? "Skrýt heslo" : "Zobrazit heslo"}
        title={visible ? "Skrýt heslo" : "Zobrazit heslo"} aria-pressed={visible}
        onClick={() => setVisible(v => !v)} className="absolute right-1 top-1/2 -translate-y-1/2 text-primary">
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  </div>;
}