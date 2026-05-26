import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [callSign, setCallSign] = useState("");
  const [role, setRole] = useState<"driver" | "dispatcher">("driver");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, call_sign: callSign, role },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("▸ ÚČET ZALOŽEN. Přihlas se.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-primary glow p-6 bg-card">
        <div className="text-center mb-6">
          <h1 className="text-3xl text-primary glow-text font-display">REGISTRACE POSÁDKY</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="CELÉ JMÉNO" value={fullName} onChange={setFullName} required />
          <Field label="VOLACÍ ZNAK (např. ALFA-7)" value={callSign} onChange={setCallSign} required />
          <Field label="EMAIL" value={email} onChange={setEmail} type="email" required />
          <Field label="HESLO (min. 6 znaků)" value={password} onChange={setPassword} type="password" required />
          <div>
            <div className="text-xs text-muted-foreground mb-1">ROLE</div>
            <div className="grid grid-cols-2 gap-2">
              {(["driver", "dispatcher"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`border py-2 text-sm tracking-widest transition-colors ${
                    role === r
                      ? "border-primary bg-primary text-primary-foreground glow"
                      : "border-primary/40 text-primary hover:border-primary"
                  }`}
                >
                  {r === "driver" ? "▸ ŘIDIČ" : "▸ DISPEČER"}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-primary text-primary py-3 hover:bg-primary hover:text-primary-foreground transition-colors font-bold tracking-widest disabled:opacity-50 mt-2"
          >
            {loading ? "▸ ZAKLÁDÁM..." : "▸ ZALOŽIT ÚČET"}
          </button>
        </form>
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
