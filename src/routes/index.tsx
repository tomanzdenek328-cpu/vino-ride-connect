import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

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
  if (!user) return <Navigate to="/login" />;
  if (role === "dispatcher") return <Navigate to="/dispatcher" />;
  if (role === "driver") return <Navigate to="/driver" />;
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-primary">Načítám roli...</div>
    </div>
  );
}
