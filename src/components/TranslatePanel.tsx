import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Languages, Loader2, X } from "lucide-react";
import { translateText } from "@/lib/translate.functions";

const LANGUAGES: { code: string; label: string }[] = [
  { code: "angličtina", label: "🇬🇧 Angličtina" },
  { code: "ukrajinština", label: "🇺🇦 Ukrajinština" },
  { code: "ruština", label: "🇷🇺 Ruština" },
  { code: "němčina", label: "🇩🇪 Němčina" },
  { code: "polština", label: "🇵🇱 Polština" },
  { code: "slovenština", label: "🇸🇰 Slovenština" },
  { code: "španělština", label: "🇪🇸 Španělština" },
  { code: "francouzština", label: "🇫🇷 Francouzština" },
  { code: "italština", label: "🇮🇹 Italština" },
  { code: "rumunština", label: "🇷🇴 Rumunština" },
  { code: "turečtina", label: "🇹🇷 Turečtina" },
  { code: "vietnamština", label: "🇻🇳 Vietnamština" },
  { code: "arabština", label: "🇸🇦 Arabština" },
];

export function TranslatePanel({ onClose }: { onClose: () => void }) {
  const translate = useServerFn(translateText);
  const [lang, setLang] = useState("angličtina");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!text.trim()) {
      toast.error("Nejprve napište text k překladu.");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const sourceLang = direction === "out" ? "češtině" : lang;
      const targetLang = direction === "out" ? lang : "češtině";
      const res = await translate({ data: { text, targetLang, sourceLang } });
      setResult(res.translated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Překlad se nezdařil.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      toast.success("Přeloženo do schránky.");
    } catch {
      toast.error("Kopírování se nezdařilo, označte text ručně.");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/80 p-2 overflow-y-auto">
      <div className="w-full max-w-md border-2 border-primary bg-background p-4 my-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-primary font-display glow-text">
            <Languages className="w-5 h-5" /> PŘEKLADAČ ZÁKAZNÍK
          </h2>
          <button onClick={onClose} className="border border-primary/60 p-1 hover:bg-primary/10" aria-label="Zavřít">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setDirection("out")}
            className={`border px-2 py-2 text-xs font-bold ${direction === "out" ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 text-primary"}`}
          >
            ČESKY → Zákazník
          </button>
          <button
            onClick={() => setDirection("in")}
            className={`border px-2 py-2 text-xs font-bold ${direction === "in" ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 text-primary"}`}
          >
            Zákazník → ČESKY
          </button>
        </div>

        <label className="block text-[11px] text-muted-foreground mb-1">
          {direction === "out" ? "Jazyk pro zákazníka" : "Jazyk, ve kterém zákazník píše/mluví"}
        </label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="w-full border border-primary/60 bg-background px-2 py-2 text-sm mb-3"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={direction === "out" ? "Napište zprávu česky (např. „Jsem u vchodu, hned vyjíždím“)…" : "Vložte nebo přepište text zákazníka…"}
          rows={3}
          className="w-full border border-primary/60 bg-background px-3 py-2 text-sm mb-3"
        />

        <button
          onClick={run}
          disabled={loading}
          className="w-full border-2 border-primary bg-primary text-primary-foreground glow px-4 py-2 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
          {loading ? "PŘEKÁDÁM…" : "PŘELOŽIT"}
        </button>

        {result && (
          <div className="mt-3">
            <div className="text-[11px] text-muted-foreground mb-1">
              {direction === "out" ? "Přeloženo – ukažte zákazníkovi:" : "Přeloženo do češtiny:"}
            </div>
            <div className="border border-primary/60 bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">{result}</div>
            <button
              onClick={copy}
              className="mt-2 border border-primary/60 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:bg-primary/10"
            >
              <Copy className="w-3.5 h-3.5" /> ZKOPÍROVAT
            </button>
          </div>
        )}

        <p className="mt-3 text-[10px] text-muted-foreground leading-snug">
          Překladač rozumí běžné i hovorové řeči. Adresy a čísla nechává beze změny.
        </p>
      </div>
    </div>
  );
}
