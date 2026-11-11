import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Languages, Loader2, Mic, Square, Volume2, X } from "lucide-react";
import { translateText } from "@/lib/translate.functions";
import { Button } from "@/components/ui/button";
import { recordWav } from "@/lib/dispatch/record-wav";
import { playTranslation, transcribeTranslation } from "@/lib/translator-voice";

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
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recorder = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const voiceRequest = useRef<AbortController | null>(null);
  const audioCache = useRef<{ text: string; chunks: Float32Array[] } | null>(null);
  const disposed = useRef(false);
  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      voiceRequest.current?.abort();
      void recorder.current?.stop().catch(() => {});
      recorder.current = null;
    };
  }, []);

  const microphone = async () => {
    setVoiceError("");
    setTranscribing(true);
    try {
      if (!recorder.current) {
        const next = await recordWav();
        if (disposed.current) { void next.stop().catch(() => {}); return; }
        recorder.current = next;
        setRecording(true);
      } else {
        const active = recorder.current; recorder.current = null; setRecording(false);
        const file = await active.stop();
        const controller = new AbortController(); voiceRequest.current = controller;
        setResult("");
        await transcribeTranslation(file, controller.signal, value => { if (!disposed.current) setText(value); });
      }
    } catch (error) {
      if (!disposed.current) setVoiceError(error instanceof Error && error.name !== 'NotAllowedError' ? error.message : 'Povolte přístup k mikrofonu v nastavení telefonu nebo prohlížeče.');
    } finally { if (!disposed.current) setTranscribing(false); }
  };

  const speak = async () => {
    if (playing) { voiceRequest.current?.abort(); return; }
    setPlaying(true); setVoiceError("");
    const controller = new AbortController(); voiceRequest.current = controller;
    let context: AudioContext | undefined;
    try {
      context = new AudioContext({ sampleRate: 24000 });
      await context.resume();
      const chunks = await playTranslation(result, context, controller.signal, audioCache.current?.text === result ? audioCache.current.chunks : undefined);
      audioCache.current = { text: result, chunks };
    } catch (error) {
      if (!disposed.current && !controller.signal.aborted) setVoiceError(error instanceof Error ? error.message : 'Přehrání se nezdařilo.');
    } finally {
      if (context && context.state !== 'closed') await context.close();
      if (!disposed.current) setPlaying(false);
    }
  };

  const resetResult = () => { setResult(""); audioCache.current = null; setVoiceError(""); };

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
    <div role="dialog" aria-modal="true" aria-label="Překladač zákazník" className="fixed inset-0 z-[120] flex items-start justify-center bg-background/90 p-2 overflow-y-auto">
      <div className="w-full max-w-md border-2 border-primary bg-background p-4 my-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-primary font-display glow-text">
            <Languages className="w-5 h-5" /> PŘEKLADAČ ZÁKAZNÍK
          </h2>
          <Button variant="outline" size="icon" onClick={onClose} aria-label="Zavřít">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <Button variant="outline" disabled={loading || recording || transcribing || playing}
            onClick={() => { setDirection("out"); resetResult(); }}
            className={`border px-2 py-2 text-xs font-bold ${direction === "out" ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 text-primary"}`}
          >
            ČESKY → Zákazník
          </Button>
          <Button variant="outline" disabled={loading || recording || transcribing || playing}
            onClick={() => { setDirection("in"); resetResult(); }}
            className={`border px-2 py-2 text-xs font-bold ${direction === "in" ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 text-primary"}`}
          >
            Zákazník → ČESKY
          </Button>
        </div>

        <label className="block text-[11px] text-muted-foreground mb-1">
          {direction === "out" ? "Jazyk pro zákazníka" : "Jazyk, ve kterém zákazník píše/mluví"}
        </label>
        <select
          value={lang}
          disabled={loading || recording || transcribing || playing}
          onChange={(e) => { setLang(e.target.value); resetResult(); }}
          className="w-full border border-primary/60 bg-background px-2 py-2 text-sm mb-3"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>

        <textarea
          aria-label="Text k překladu"
          value={text}
          disabled={recording || transcribing || loading || playing}
          maxLength={6000}
          onChange={(e) => { setText(e.target.value); resetResult(); }}
          placeholder={direction === "out" ? "Napište zprávu česky (např. „Jsem u vchodu, hned vyjíždím“)…" : "Vložte nebo přepište text zákazníka…"}
          rows={3}
          className="w-full border border-primary/60 bg-background px-3 py-2 text-sm mb-3"
        />

        <Button variant={recording ? "destructive" : "outline"} onClick={microphone} disabled={transcribing || loading || playing} className="w-full mb-3" aria-label={recording ? "Ukončit nahrávání" : "Zadat mikrofonem"}>
          {transcribing ? <Loader2 className="animate-spin" /> : recording ? <Square /> : <Mic />}
          {transcribing ? "PŘEPISUJI…" : recording ? "UKONČIT NAHRÁVÁNÍ" : "ZADAT MIKROFONEM"}
        </Button>

        <Button
          onClick={run}
          disabled={loading || recording || transcribing || playing}
          className="w-full border-2 border-primary bg-primary text-primary-foreground glow px-4 py-2 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
          {loading ? "PŘEKLÁDÁM…" : "PŘELOŽIT"}
        </Button>
        {voiceError && <p role="alert" className="mt-2 text-sm text-destructive whitespace-pre-wrap">{voiceError}</p>}

        {result && (
          <div className="mt-3">
            <div className="text-[11px] text-muted-foreground mb-1">
              {direction === "out" ? "Přeloženo – ukažte zákazníkovi:" : "Přeloženo do češtiny:"}
            </div>
            <div aria-label="Přeložený text" className="border border-primary/60 bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap break-words">{result}</div>
            <div className="flex flex-wrap gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={speak}>
              {playing ? <Square /> : <Volume2 />} {playing ? "ZASTAVIT ZVUK" : "PŘEHRÁT PŘEKLAD"}
            </Button>
            <Button variant="outline" size="sm"
              onClick={copy}
              className="text-xs font-bold"
            >
              <Copy className="w-3.5 h-3.5" /> ZKOPÍROVAT
            </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
