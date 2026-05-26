import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Přihlášení selhalo: " + error.message);
      return;
    }
    toast.success("▸ SPOJENÍ NAVÁZÁNO");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-primary glow p-6 bg-card">
        <div className="text-center mb-6">
          <img src={logo} alt="Vinné Taxi" className="w-full max-w-[260px] mx-auto drop-shadow-[0_0_18px_rgba(57,255,20,0.5)]" />
          <div className="text-xs text-muted-foreground mt-2 tracking-widest">▸ DISPATCH TERMINAL v1.0</div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="EMAIL" value={email} onChange={setEmail} type="email" required />
          <Field label="HESLO" value={password} onChange={setPassword} type="password" required />
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-primary text-primary py-3 hover:bg-primary hover:text-primary-foreground transition-colors font-bold tracking-widest disabled:opacity-50"
          >
            {loading ? "▸ NAVAZUJI..." : "▸ PŘIHLÁSIT"}
          </button>
        </form>
        <div className="mt-6 text-center text-[11px] text-muted-foreground">
          Účet zakládá dispečer.
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-input border border-primary/40 px-3 py-2 text-primary focus:border-primary focus:outline-none focus:glow"
      />
    </label>
  );
}
