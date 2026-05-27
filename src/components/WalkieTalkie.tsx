import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Mic, MicOff, Power } from "lucide-react";
import { toast } from "sonner";

// WebRTC mesh walkie-talkie. Signaling via Supabase realtime broadcast.
// Flow:
//  1) User taps "Aktivovat" → we request microphone (must be in user gesture)
//     and join the "radio" presence channel.
//  2) For every other present user we create an RTCPeerConnection with
//     a sendrecv audio transceiver. Initiator (lower userId) creates the offer.
//  3) Local audio track is added to every peer immediately, but kept disabled.
//  4) PTT press → enable track. PTT release → disable. Other side hears via
//     ontrack + onunmute/onmute.

interface Props {
  userId: string;
  callSign: string;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  remoteCallSign?: string;
  sender?: RTCRtpSender;
}

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function WalkieTalkie({ userId, callSign }: Props) {
  const [active, setActive] = useState(false);
  const [transmitting, setTransmitting] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeRef = useRef(false);

  const cleanupPeer = (peerId: string) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    try { entry.pc.close(); } catch {}
    entry.audio.pause();
    entry.audio.srcObject = null;
    peersRef.current.delete(peerId);
    setPeerCount(peersRef.current.size);
  };

  const attachLocalTrack = (entry: PeerEntry) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    if (entry.sender) {
      if (entry.sender.track !== track) {
        entry.sender.replaceTrack(track).catch((e) => console.warn("[radio] replaceTrack", e));
      }
    } else {
      try {
        entry.sender = entry.pc.addTrack(track, stream);
      } catch (e) {
        console.warn("[radio] addTrack", e);
      }
    }
  };

  const createPeer = (
    peerId: string,
    peerCallSign: string,
    isInitiator: boolean,
    ch: ReturnType<typeof supabase.channel>
  ): PeerEntry => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(ICE);
    const audio = new Audio();
    audio.autoplay = true;
    const entry: PeerEntry = { pc, audio, remoteCallSign: peerCallSign };
    peersRef.current.set(peerId, entry);
    setPeerCount(peersRef.current.size);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        ch.send({
          type: "broadcast",
          event: "ice",
          payload: { to: peerId, from: userId, candidate: ev.candidate },
        });
      }
    };

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      audio.srcObject = stream;
      audio.play().catch(() => {});
      stream.getAudioTracks().forEach((t) => {
        const name = entry.remoteCallSign ?? peerId.slice(0, 4);
        t.onunmute = () => setActiveSpeaker(name);
        t.onmute = () => setActiveSpeaker((cur) => (cur === name ? null : cur));
      });
    };

    pc.onconnectionstatechange = () => {
      console.log("[radio] peer", peerId.slice(0, 6), "state:", pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        cleanupPeer(peerId);
      }
    };

    // For initiator we add the audio track (creates the m-line);
    // the answerer will mirror it via setRemoteDescription.
    if (isInitiator) {
      attachLocalTrack(entry);
      // Make sure we receive too even if we have no local track yet.
      if (!entry.sender) {
        pc.addTransceiver("audio", { direction: "sendrecv" });
      }
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ch.send({
            type: "broadcast",
            event: "offer",
            payload: { to: peerId, from: userId, fromCall: callSign, sdp: offer },
          });
        } catch (e) {
          console.error("[radio] createOffer", e);
        }
      })();
    }

    return entry;
  };

  const activate = async () => {
    if (activeRef.current) return;
    setError(null);
    try {
      // Request microphone synchronously inside the user gesture.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      localStreamRef.current = stream;
    } catch (e: any) {
      console.error("[radio] mic error", e);
      const msg = e?.name === "NotAllowedError"
        ? "Mikrofon je zakázaný. Povolte přístup v nastavení prohlížeče."
        : "Mikrofon není k dispozici.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const ch = supabase.channel("radio", {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.to !== userId) return;
      const entry = createPeer(payload.from, payload.fromCall, false, ch);
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        // After SDP, the transceiver exists — make sure local track is attached.
        const transceivers = entry.pc.getTransceivers();
        const audioTx = transceivers.find((t) => t.receiver.track?.kind === "audio") ?? transceivers[0];
        if (audioTx) {
          audioTx.direction = "sendrecv";
          entry.sender = audioTx.sender;
          attachLocalTrack(entry);
        }
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        ch.send({
          type: "broadcast",
          event: "answer",
          payload: { to: payload.from, from: userId, sdp: answer },
        });
      } catch (e) {
        console.error("[radio] handle offer", e);
      }
    });

    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.to !== userId) return;
      const entry = peersRef.current.get(payload.from);
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch (e) {
        console.error("[radio] handle answer", e);
      }
    });

    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (payload.to !== userId) return;
      const entry = peersRef.current.get(payload.from);
      if (!entry) return;
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (e) {
        console.warn("[radio] addIceCandidate", e);
      }
    });

    ch.on("broadcast", { event: "leave" }, ({ payload }) => {
      cleanupPeer(payload.from);
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ callSign: string }>>;
      const ids = Object.keys(state).filter((id) => id !== userId);
      ids.forEach((pid) => {
        const peerCall = state[pid]?.[0]?.callSign ?? "—";
        if (!peersRef.current.has(pid) && userId < pid) {
          createPeer(pid, peerCall, true, ch);
        }
      });
      peersRef.current.forEach((_, pid) => {
        if (!ids.includes(pid)) cleanupPeer(pid);
      });
    });

    ch.subscribe(async (status) => {
      console.log("[radio] channel status", status);
      if (status === "SUBSCRIBED") {
        await ch.track({ callSign });
        activeRef.current = true;
        setActive(true);
        toast.success("Vysílačka aktivní");
      }
    });
    channelRef.current = ch;
  };

  const deactivate = () => {
    const ch = channelRef.current;
    if (ch) {
      ch.send({ type: "broadcast", event: "leave", payload: { from: userId } }).catch(() => {});
      supabase.removeChannel(ch);
      channelRef.current = null;
    }
    peersRef.current.forEach((_, id) => cleanupPeer(id));
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    activeRef.current = false;
    setActive(false);
    setTransmitting(false);
    setActiveSpeaker(null);
  };

  useEffect(() => {
    return () => {
      deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTransmit = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = true;
    setTransmitting(true);
  };

  const stopTransmit = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = false;
    setTransmitting(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 select-none">
      {activeSpeaker && (
        <div className="bg-black border border-primary px-3 py-1 text-xs glow-text flex items-center gap-2">
          <Radio className="w-3 h-3 blink" /> ▸ {activeSpeaker}
        </div>
      )}
      {error && (
        <div className="bg-black border border-destructive px-3 py-1 text-[10px] text-destructive max-w-[200px] text-right">
          {error}
        </div>
      )}
      {active && (
        <div className="flex items-center gap-2 bg-black border border-primary/40 px-2 py-1 text-[10px] text-muted-foreground">
          <span>NET: {peerCount}</span>
          <button
            onClick={deactivate}
            className="text-destructive hover:underline"
            aria-label="Vypnout vysílačku"
          >
            <Power className="w-3 h-3" />
          </button>
        </div>
      )}
      {!active ? (
        <button
          onClick={activate}
          className="w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center font-display text-[10px] bg-black border-primary/60 text-primary/80 hover:bg-primary hover:text-primary-foreground transition-colors"
          aria-label="Aktivovat vysílačku"
        >
          <MicOff className="w-6 h-6" />
          <span className="mt-0.5 tracking-wider">ZAPNOUT</span>
        </button>
      ) : (
        <button
          onMouseDown={startTransmit}
          onMouseUp={stopTransmit}
          onMouseLeave={stopTransmit}
          onTouchStart={(e) => { e.preventDefault(); startTransmit(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopTransmit(); }}
          className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center font-display text-xs transition-colors ${
            transmitting
              ? "bg-destructive text-destructive-foreground border-destructive ptt-pulse"
              : "bg-black border-primary text-primary hover:bg-primary hover:text-primary-foreground glow"
          }`}
          aria-label="Push to talk"
        >
          <Mic className="w-7 h-7" />
          <span className="mt-0.5 tracking-wider">PTT</span>
        </button>
      )}
    </div>
  );
}
