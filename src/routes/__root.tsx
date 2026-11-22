import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "sonner";
import { InstallBanner } from "@/components/InstallBanner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary glow-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">SIGNAL LOST</h2>
        <p className="mt-2 text-sm text-muted-foreground">Tato frekvence není v provozu.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors glow"
          >
            ▸ ZPĚT NA ZÁKLADNU
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-destructive">PORUCHA SYSTÉMU</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md border border-primary px-4 py-2 text-sm text-primary hover:bg-primary hover:text-primary-foreground"
          >
            ▸ ZNOVU
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VINNÉ TAXI ▸ DISPATCH" },
      { name: "description", content: "Dispečerský systém pro Vinné Taxi" },
      { property: "og:title", content: "VINNÉ TAXI ▸ DISPATCH" },
      { name: "twitter:title", content: "VINNÉ TAXI ▸ DISPATCH" },
      { property: "og:description", content: "Dispečerský systém pro Vinné Taxi" },
      { name: "twitter:description", content: "Dispečerský systém pro Vinné Taxi" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <HeadContent />
      </head>
      <body className="vine-bg">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <InstallBanner />
      <Toaster
        theme="dark"
        position="top-center"
        closeButton
        duration={4500}
        visibleToasts={3}
        toastOptions={{
        style: {
          background: "rgba(10,13,10,0.95)",
          border: "1px solid color-mix(in oklab, var(--color-primary) 35%, transparent)",
          color: "var(--color-foreground)",
          fontFamily: "var(--font-sans)",
          borderRadius: "14px",
          backdropFilter: "blur(12px)",
        },
        }}
      />
    </QueryClientProvider>
  );
}
