import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import appBg from "@/assets/app-bg.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const redirected = useRef(false);
  const isDriver = pathname.startsWith("/driver");

  // Jednorázové přesměrování na login – opakované <Navigate> zacyklí router.
  useEffect(() => {
    if (redirected.current || loading || user) return;
    redirected.current = true;
    navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-primary font-display text-2xl">▸ AUTH<span className="blink">_</span></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${appBg.url})` }}
        aria-hidden
      />
      <div
        className={
          isDriver
            ? "fixed inset-0 bg-background/45"
            : "fixed inset-0 bg-background/85 backdrop-blur-[2px]"
        }
        aria-hidden
      />
      <div className="relative z-10 min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}

