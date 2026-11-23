import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PasswordField } from "@/components/PasswordField";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [
    { title: "Registrace | Vinné Taxi" },
    { name: "description", content: "Vytvoření účtu v aplikaci Vinné Taxi." },
    { property: "og:title", content: "Registrace | Vinné Taxi" },
    { property: "og:description", content: "Vytvoření účtu v aplikaci Vinné Taxi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [callSign, setCallSign] = useState("");
  const [role, setRole] = useState<"driver" | "dispatcher">("driver");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (role === "dispatcher" && !code.trim()) { toast.error("Zadej kód dispečera."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: role === "dispatcher"
          ? { full_name: fullName, call_sign: callSign, requested_role: "dispatcher", dispatch_code: code.trim() }
          : { full_name: fullName, call_sign: callSign },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(role === "dispatcher" && /database|saving|INVALID_DISPATCH_CODE/i.test(error.message) ? "Špatný kód dispečera – registrace nebyla dokončena." : error.message);
      return;
    }
    if (!data.session) { setConfirmation(true); return; }
    toast.success(role === "dispatcher" ? "▸ ÚČET DISPEČERA ZALOŽEN" : "▸ ÚČET ŘIDIČE ZALOŽEN");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-primary glow p-6 bg-card">
        <div className="text-center mb-6">
          <h1 className="text-3xl text-primary glow-text font-display">{role === "dispatcher" ? "REGISTRACE DISPEČERA" : "REGISTRACE ŘIDIČE"}</h1>
        </div>
        {confirmation ? <div className="text-center space-y-3" role="status">
          <h2 className="text-primary font-bold">POTVRĎTE SVŮJ EMAIL</h2>
          <p className="text-sm text-muted-foreground">Na zadaný email jsme poslali odkaz pro potvrzení účtu. Poté se můžete přihlásit.</p>
        </div> : <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["driver", "dispatcher"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`border py-2 text-xs font-bold ${role === r ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 text-primary"}`}>
                {r === "driver" ? "ŘIDIČ" : "DISPEČER"}
              </button>
            ))}
          </div>
          {role === "dispatcher" && <PasswordField label="KÓD DISPEČERA" value={code} onChange={setCode} autoComplete="off" />}
          <Field label="CELÉ JMÉNO" value={fullName} onChange={setFullName} required />
          <Field label="VOLACÍ ZNAK (např. ALFA-7)" value={callSign} onChange={setCallSign} required />
          <Field label="EMAIL" value={email} onChange={setEmail} type="email" required />
          <PasswordField label="HESLO (min. 6 znaků)" value={password} onChange={setPassword} autoComplete="new-password" minLength={6} />
          <Button
            variant="outline"
            type="submit"
            disabled={loading}
            className="w-full border border-primary text-primary py-3 hover:bg-primary hover:text-primary-foreground transition-colors font-bold tracking-widest disabled:opacity-50 mt-2"
          >
            {loading ? "▸ ZAKLÁDÁM..." : "▸ ZALOŽIT ÚČET"}
          </Button>
        </form>}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Už máš účet?{" "}
          <Link to="/login" className="text-primary hover:underline">PŘIHLÁSIT</Link>
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
