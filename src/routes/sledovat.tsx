import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CustomerShell, CustomerCard } from "@/components/CustomerShell";

export const Route = createFileRoute("/sledovat")({
  head: () => ({
    meta: [
      { title: "Sledovat objednávku – Vinné Taxi" },
      { name: "description", content: "Zadejte kód objednávky a sledujte stav jízdy i polohu vozu." },
      { property: "og:title", content: "Sledovat objednávku – Vinné Taxi" },
      { property: "og:description", content: "Zadejte kód objednávky a sledujte stav jízdy i polohu vozu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackForm,
});

function TrackForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  return (
    <CustomerShell>
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4">
      <CustomerCard>
      <h1 className="font-display text-xl text-primary glow-text">▸ SLEDOVAT JÍZDU</h1>
      <form
        className="w-full max-w-xs space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim().length >= 4) navigate({ to: "/jizda/$code", params: { code: code.trim().toUpperCase() } });
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="KÓD OBJEDNÁVKY"
          className="w-full bg-input border border-primary/40 px-3 py-2 text-primary text-center tracking-widest focus:border-primary focus:outline-none"
        />
        <button type="submit" className="w-full border border-primary text-primary py-2 font-bold tracking-widest glow">
          ▸ ZOBRAZIT
        </button>
      </form>
      </CustomerCard>
      </div>
    </CustomerShell>
  );
}
