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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-destructive">PORUCHA SYSTÉMU</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
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
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9d2e146d-b3ee-4933-942a-658b49308448/id-preview-37e02904--c365af5e-ff6f-4fb8-8ed6-0bd82bd36982.lovable.app-1779828027109.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9d2e146d-b3ee-4933-942a-658b49308448/id-preview-37e02904--c365af5e-ff6f-4fb8-8ed6-0bd82bd36982.lovable.app-1779828027109.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
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
      <body className="crt">
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
      <Toaster theme="dark" position="top-center" toastOptions={{
        style: {
          background: "#000",
          border: "1px solid var(--color-phosphor)",
          color: "var(--color-phosphor)",
          fontFamily: "var(--font-mono)",
        },
      }} />
    </QueryClientProvider>
  );
}
