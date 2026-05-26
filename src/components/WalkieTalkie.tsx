import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Mic } from "lucide-react";

// Simple WebRTC mesh walkie-talkie. Signaling via Supabase realtime broadcast.
// Each online user joins "radio" channel, exchanges offers/answers/ICE,
// and streams microphone audio while PTT button is held.

interface Props {
  userId: string;
  callSign: string;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  remoteCallSign?: string;
}

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function WalkieTalkie({ userId, callSign }: Props) {
  const [transmitting, setTransmitting] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);

  // Setup signaling channel
  useEffect(() => {
    mountedRef.current = true;
    const ch = supabase.channel("radio", {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

    const cleanupPeer = (peerId: string) => {
      const entry = peersRef.current.get(peerId);
      if (entry) {
        entry.pc.close();
        entry.audio.pause();
        entry.audio.srcObject = null;
        peersRef.current.delete(peerId);
        setPeerCount(peersRef.current.size);
      }
    };

    const createPeer = (peerId: string, peerCallSign: string, isInitiator: boolean) => {
      if (peersRef.current.has(peerId)) return peersRef.current.get(peerId)!;
      const pc = new RTCPeerConnection(ICE);
      const audio = new Audio();
      audio.autoplay = true;
      const entry: PeerEntry = { pc, audio, remoteCallSign: peerCallSign };
      peersRef.current.set(peerId, entry);
      setPeerCount(peersRef.current.size);

      // Pre-add an inactive audio transceiver so we can send when we transmit.
      pc.addTransceiver("audio", { direction: "sendrecv" });

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          ch.send({ type: "broadcast", event: "ice", payload: { to: peerId, from: userId, candidate: ev.candidate } });
        }
      };
      pc.ontrack = (ev) => {
        audio.srcObject = ev.streams[0];
        ev.streams[0].getAudioTracks().forEach((t) => {
          t.onunmute = () => setActiveSpeaker(entry.remoteCallSign ?? peerId.slice(0, 4));
          t.onmute = () => setActiveSpeaker((cur) => (cur === entry.remoteCallSign ? null : cur));
        });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") cleanupPeer(peerId);
      };

      if (isInitiator) {
        (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ch.send({ type: "broadcast", event: "offer", payload: { to: peerId, from: userId, fromCall: callSign, sdp: offer } });
        })();
      }
      return entry;
    };

    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.to !== userId) return;
      const entry = createPeer(payload.from, payload.fromCall, false);
      await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      ch.send({ type: "broadcast", event: "answer", payload: { to: payload.from, from: userId, sdp: answer } });
    });
    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.to !== userId) return;
      const entry = peersRef.current.get(payload.from);
      if (entry) await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    });
    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (payload.to !== userId) return;
      const entry = peersRef.current.get(payload.from);
      if (entry) {
        try { await entry.pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
      }
    });
    ch.on("broadcast", { event: "leave" }, ({ payload }) => {
      cleanupPeer(payload.from);
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ callSign: string }>>;
      const ids = Object.keys(state).filter((id) => id !== userId);
      // Initiator if our userId < peerId (deterministic)
      ids.forEach((pid) => {
        const peerCall = state[pid]?.[0]?.callSign ?? "—";
        if (!peersRef.current.has(pid) && userId < pid) {
          createPeer(pid, peerCall, true);
        }
      });
      // Remove peers that left
      peersRef.current.forEach((_, pid) => {
        if (!ids.includes(pid)) cleanupPeer(pid);
      });
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ callSign });
      }
    });
    channelRef.current = ch;

    return () => {
      mountedRef.current = false;
      ch.send({ type: "broadcast", event: "leave", payload: { from: userId } }).catch(() => {});
      peersRef.current.forEach((e) => { e.pc.close(); e.audio.srcObject = null; });
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, callSign]);

  const startTransmit = async () => {
    if (muted) return;
    try {
      if (!localStreamRef.current) {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }
      const track = localStreamRef.current.getAudioTracks()[0];
      track.enabled = true;
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio") ?? pc.getTransceivers().find(t => t.sender.track?.kind !== "video")?.sender;
        if (sender && sender.track !== track) sender.replaceTrack(track).catch(() => {});
        else if (!sender) pc.addTrack(track, localStreamRef.current!);
      });
      setTransmitting(true);
    } catch (e) {
      console.error("Microphone error", e);
      setMuted(true);
    }
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
      <div className="flex items-center gap-2 bg-black border border-primary/40 px-2 py-1 text-[10px] text-muted-foreground">
        <span>NET: {peerCount}</span>
      </div>
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
    </div>
  );
}
