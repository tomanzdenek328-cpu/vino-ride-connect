import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const redirected = useRef(false);

  // Přesměrování provedeme jen jednou, jinak router zacyklí (Maximum update depth).
  useEffect(() => {
    if (redirected.current || loading || !user) return;
    if (role === "dispatcher") {
      redirected.current = true;
      navigate({ to: "/dispatcher", replace: true });
    } else if (role === "driver") {
      redirected.current = true;
      navigate({ to: "/driver", replace: true });
    }
  }, [loading, user, role, navigate]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-primary glow-text font-display text-3xl">
          ▸ NAVAZUJE SE SPOJENÍ<span className="blink">_</span>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <img
        src={logo}
        alt="Vinné Taxi"
        className="w-full max-w-md drop-shadow-[0_0_25px_rgba(57,255,20,0.45)]"
      />
      <div className="text-center mt-4 text-xs text-muted-foreground tracking-widest">
        ▸ DISPATCH TERMINAL v1.0
      </div>
      <Link
        to="/login"
        className="mt-8 border border-primary text-primary px-8 py-3 hover:bg-primary hover:text-primary-foreground tracking-widest font-bold glow"
      >
        ▸ PŘIHLÁSIT
      </Link>
    </div>
  );
}
