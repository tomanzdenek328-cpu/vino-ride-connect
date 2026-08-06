import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-primary glow-text font-display text-3xl">
          ▸ NAVAZUJE SE SPOJENÍ<span className="blink">_</span>
        </div>
      </div>
    );
  }
  if (user) {
    if (role === "dispatcher") return <Navigate to="/dispatcher" />;
    if (role === "driver") return <Navigate to="/driver" />;
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-primary">Načítám roli...</div>
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
        to="/objednat"
        className="mt-8 border border-primary bg-primary/10 text-primary px-8 py-3 hover:bg-primary hover:text-primary-foreground tracking-widest font-bold glow"
      >
        ▸ OBJEDNAT TAXI
      </Link>
      <Link
        to="/login"
        className="mt-3 border border-border text-muted-foreground px-8 py-2 text-sm tracking-widest"
      >
        ▸ PŘIHLÁSIT (ŘIDIČ / DISPEČER)
      </Link>
    </div>
  );
}
