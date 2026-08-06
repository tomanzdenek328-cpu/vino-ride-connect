import type { ReactNode } from "react";
import bg from "@/assets/customer-bg.jpg";

/** Veselý zákaznický layout s fotkou na pozadí – bez přihlášení pro řidiče/dispečera. */
export function CustomerShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
        aria-hidden
      />
      <div className="fixed inset-0 bg-background/70 backdrop-blur-[2px]" aria-hidden />
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}

export function CustomerCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-background/80 backdrop-blur-md p-4 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
      {children}
    </div>
  );
}
