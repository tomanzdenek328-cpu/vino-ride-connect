import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mic, MicOff, Power, Radio } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  callSign: string;
}

interface IncomingVoice {
  fromCall: string;
  mimeType: string;
  total: number;
  received: number;
  chunks: string[];
  timeoutId: number;
}

const MAX_RECORDING_MS = 20_000;
const BROADCAST_CHUNK_SIZE = 45_000;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const options = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToArrayBuffer(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function WalkieTalkie({ userId, callSign }: Props) {
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inboxRef = useRef<Map<string, IncomingVoice>>(new Map());
  const stopTimerRef = useRef<number | null>(null);

  const cleanupInbox = () => {
    inboxRef.current.forEach((item) => window.clearTimeout(item.timeoutId));
    inboxRef.current.clear();
  };

  const stopLocalTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const getAudioContext = async () => {
    const AudioCtx =
      window.AudioContext ??
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playVoice = async (base64: string, fromCall: string) => {
    try {
      const ctx = await getAudioContext();
      if (!ctx) throw new Error("AudioContext není dostupný");
      const buffer = await ctx.decodeAudioData(base64ToArrayBuffer(base64).slice(0));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      setActiveSpeaker(fromCall);
      source.onended = () => setActiveSpeaker((current) => (current === fromCall ? null : current));
      source.start();
    } catch (e) {
      console.warn("[radio] playback failed", e);
      setError("Příjem zvuku selhal. Zkuste znovu zapnout vysílačku.");
    }
  };

  const sendVoice = async (blob: Blob) => {
    const ch = channelRef.current;
    if (!ch || !blob.size) return;

    setSending(true);
    try {
      const base64 = await blobToBase64(blob);
      const total = Math.max(1, Math.ceil(base64.length / BROADCAST_CHUNK_SIZE));
      const messageId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      for (let index = 0; index < total; index += 1) {
        const chunk = base64.slice(index * BROADCAST_CHUNK_SIZE, (index + 1) * BROADCAST_CHUNK_SIZE);
        await ch.send({
          type: "broadcast",
          event: "voice-chunk",
          payload: {
            id: messageId,
            from: userId,
            fromCall: callSign,
            mimeType: blob.type,
            index,
            total,
            chunk,
          },
        });
      }
    } catch (e) {
      console.error("[radio] send failed", e);
      toast.error("Vysílačku se nepodařilo odeslat");
    } finally {
      setSending(false);
    }
  };

  const activate = async () => {
    if (activeRef.current) return;
    setError(null);

    if (typeof MediaRecorder === "undefined") {
      const msg = "Tento prohlížeč neumí nahrávání vysílačky.";
      setError(msg);
      toast.error(msg);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.getAudioTracks().forEach((track) => (track.enabled = false));
      streamRef.current = stream;
      await getAudioContext();
    } catch (e: unknown) {
      console.error("[radio] mic error", e);
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Mikrofon je zakázaný. Povolte přístup v nastavení prohlížeče."
          : "Mikrofon není k dispozici.";
      setError(msg);
      toast.error(msg);
      stopLocalTracks();
      return;
    }

    const ch = supabase.channel("radio_voice", {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

    ch.on("broadcast", { event: "voice-chunk" }, ({ payload }) => {
      if (!payload || payload.from === userId) return;
      const id = String(payload.id ?? "");
      const index = Number(payload.index);
      const total = Number(payload.total);
      const chunk = String(payload.chunk ?? "");
      if (!id || !Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total || !chunk) return;

      let incoming = inboxRef.current.get(id);
      if (!incoming) {
        const timeoutId = window.setTimeout(() => inboxRef.current.delete(id), 30_000);
        incoming = {
          fromCall: String(payload.fromCall ?? "Vysílačka"),
          mimeType: String(payload.mimeType ?? ""),
          total,
          received: 0,
          chunks: Array.from({ length: total }, () => ""),
          timeoutId,
        };
        inboxRef.current.set(id, incoming);
      }

      if (!incoming.chunks[index]) {
        incoming.chunks[index] = chunk;
        incoming.received += 1;
      }

      if (incoming.received >= incoming.total) {
        window.clearTimeout(incoming.timeoutId);
        inboxRef.current.delete(id);
        void playVoice(incoming.chunks.join(""), incoming.fromCall);
      }
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ callSign: string }>>;
      setPeerCount(Object.keys(state).filter((id) => id !== userId).length);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ callSign });
        activeRef.current = true;
        setActive(true);
        toast.success("Vysílačka aktivní");
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setError("Spojení vysílačky se nepodařilo navázat.");
      }
    });

    channelRef.current = ch;
  };

  const deactivate = () => {
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    recordedChunksRef.current = [];

    const ch = channelRef.current;
    if (ch) {
      supabase.removeChannel(ch);
      channelRef.current = null;
    }

    cleanupInbox();
    stopLocalTracks();
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    activeRef.current = false;
    setActive(false);
    setRecording(false);
    setSending(false);
    setActiveSpeaker(null);
    setPeerCount(0);
  };

  useEffect(() => {
    return () => deactivate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTransmit = async () => {
    if (!activeRef.current || recording || sending) return;
    const stream = streamRef.current;
    const track = stream?.getAudioTracks()[0];
    if (!stream || !track) return;

    setError(null);
    recordedChunksRef.current = [];
    track.enabled = true;

    try {
      await getAudioContext();
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        track.enabled = false;
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        recordedChunksRef.current = [];
        void sendVoice(blob);
      };
      recorder.start();
      setRecording(true);
      stopTimerRef.current = window.setTimeout(stopTransmit, MAX_RECORDING_MS);
    } catch (e) {
      console.error("[radio] record failed", e);
      track.enabled = false;
      setRecording(false);
      setError("Nahrávání vysílačky se nepodařilo spustit.");
    }
  };

  const stopTransmit = () => {
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    streamRef.current?.getAudioTracks().forEach((track) => (track.enabled = false));
    setRecording(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 select-none">
      {activeSpeaker && (
        <div className="bg-background border border-primary px-3 py-1 text-xs glow-text flex items-center gap-2">
          <Radio className="w-3 h-3 blink" /> ▸ {activeSpeaker}
        </div>
      )}
      {error && (
        <div className="bg-background border border-destructive px-3 py-1 text-[10px] text-destructive max-w-[220px] text-right">
          {error}
        </div>
      )}
      {active && (
        <div className="flex items-center gap-2 bg-background border border-primary/40 px-2 py-1 text-[10px] text-muted-foreground">
          <span>{sending ? "ODESÍLÁM" : `NET: ${peerCount}`}</span>
          <button onClick={deactivate} className="text-destructive hover:underline" aria-label="Vypnout vysílačku">
            <Power className="w-3 h-3" />
          </button>
        </div>
      )}
      {!active ? (
        <button
          onClick={activate}
          className="w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center font-display text-[10px] bg-background border-primary/60 text-primary/80 hover:bg-primary hover:text-primary-foreground transition-colors"
          aria-label="Aktivovat vysílačku"
        >
          <MicOff className="w-6 h-6" />
          <span className="mt-0.5 tracking-wider">ZAPNOUT</span>
        </button>
      ) : (
        <button
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); void startTransmit(); }}
          onPointerUp={stopTransmit}
          onPointerCancel={stopTransmit}
          onLostPointerCapture={stopTransmit}
          disabled={sending}
          className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center font-display text-xs transition-colors disabled:opacity-60 ${
            recording
              ? "bg-destructive text-destructive-foreground border-destructive ptt-pulse"
              : "bg-background border-primary text-primary hover:bg-primary hover:text-primary-foreground glow"
          }`}
          aria-label="Push to talk"
        >
          <Mic className="w-7 h-7" />
          <span className="mt-0.5 tracking-wider">{recording ? "MLUV" : "PTT"}</span>
        </button>
      )}
    </div>
  );
}