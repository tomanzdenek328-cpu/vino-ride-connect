import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";

import { CustomerShell, CustomerCard } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sledovat")({
  head: () => ({
    meta: [
      { title: "Sledovat objednávku – Vinné Taxi" },
      { name: "description", content: "Zadejte kód své jízdy nebo objednejte novou jízdu Vinným Taxi bez přihlášení." },
      { property: "og:title", content: "Sledovat objednávku – Vinné Taxi" },
      { property: "og:description", content: "Zadejte kód své jízdy nebo objednejte novou jízdu Vinným Taxi bez přihlášení." },
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
      <h1 className="mb-4 font-display text-xl text-primary glow-text">▸ ZADAT KÓD JÍZDY</h1>
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
          aria-label="Kód jízdy"
          autoComplete="off"
          className="w-full bg-input border border-primary/40 px-3 py-2 text-primary text-center tracking-widest focus:border-primary focus:outline-none"
        />
        <Button variant="outline" type="submit" className="w-full border border-primary text-primary py-2 font-bold tracking-widest glow">
          ▸ ZOBRAZIT
        </Button>
      </form>
      <div className="mt-5 w-full max-w-xs border-t border-border pt-5">
        <Button asChild className="w-full">
          <Link to="/objednat" search={{ nova: true }}><Plus /> Objednat novou jízdu</Link>
        </Button>
      </div>
      </CustomerCard>
      </div>
    </CustomerShell>
  );
}
