import { createFileRoute, Link } from "@tanstack/react-router";
import { Share, Smartphone } from "lucide-react";
import { CustomerShell } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/zakaznik-instalace")({
  head: () => ({
    meta: [
      { title: "Zákaznická ikona na ploše – Vinné Taxi" },
      { name: "description", content: "Přidejte zákaznické Vinné Taxi na plochu Androidu nebo iPhonu. Vlastní jízda podle kódu bez registrace." },
      { property: "og:title", content: "Zákaznická ikona na ploše – Vinné Taxi" },
      { property: "og:description", content: "Zákaznické Vinné Taxi na ploše telefonu, bez přihlášení a registrace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerInstallPage,
});

function CustomerInstallPage() {
  return (
    <CustomerShell>
      <main className="mx-auto max-w-lg px-6 py-10 pb-24">
        <img src={logo} alt="Vinné Taxi" className="mx-auto mb-6 w-full max-w-60" />
        <h1 className="text-center text-2xl text-primary">Vinné Taxi pro zákazníky</h1>
        <Button asChild className="my-8 w-full">
          <Link to="/sledovat"><Smartphone /> Otevřít zadání kódu jízdy</Link>
        </Button>
        <section className="border-t border-border py-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg"><Smartphone size={20} /> Android</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            <li>Otevřete zadání kódu jízdy tlačítkem výše v Chromu.</li>
            <li>Klepněte na nabídku <strong>⋮</strong> a vyberte <strong>Přidat na plochu</strong> nebo <strong>Nainstalovat aplikaci</strong>.</li>
            <li>Potvrďte přidání ikony <strong>Moje taxi</strong>.</li>
          </ol>
        </section>
        <section className="border-t border-border py-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg"><Share size={20} /> iPhone</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            <li>Otevřete zadání kódu jízdy tlačítkem výše v Safari.</li>
            <li>Klepněte na <strong>Sdílet</strong> a vyberte <strong>Přidat na plochu</strong>.</li>
            <li>Pokud se zobrazí <strong>Otevřít jako webovou aplikaci</strong>, nechte tuto volbu zapnutou a klepněte na <strong>Přidat</strong>.</li>
          </ol>
        </section>
      </main>
    </CustomerShell>
  );
}