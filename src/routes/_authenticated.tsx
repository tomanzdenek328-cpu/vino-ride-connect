import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-primary font-display text-2xl">▸ AUTH<span className="blink">_</span></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <Outlet />;
}
