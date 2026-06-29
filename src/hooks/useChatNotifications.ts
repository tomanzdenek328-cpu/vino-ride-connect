import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IncomingMsg {
  id: string;
  sender_id: string;
  thread_key: string;
  participants: string[] | null;
  body: string;
  created_at: string;
}

const LS_KEY = (uid: string) => `chat_lastread_${uid}`;

function loadLastRead(uid: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY(uid)) || "{}"); } catch { return {}; }
}
function saveLastRead(uid: string, v: Record<string, number>) {
  try { localStorage.setItem(LS_KEY(uid), JSON.stringify(v)); } catch {}
}

/**
 * Subscribe to ALL chat_messages inserts the user can see; track unread per thread.
 * Triggers a toast + browser notification for messages from someone else.
 */
export function useChatNotifications(opts: {
  userId: string | null;
  role: "driver" | "dispatcher";
  chatOpen: boolean;
  activeThread: string | null;
}) {
  const { userId, role, chatOpen, activeThread } = opts;
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [lastSenderName, setLastSenderName] = useState<string | null>(null);
  const [flash, setFlash] = useState(0); // ticks to drive blink
  const lastReadRef = useRef<Record<string, number>>({});

  // Ask for notification permission once
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Recompute unread from cached lastRead — initial load skipped for simplicity.
  useEffect(() => {
    if (!userId) return;
    lastReadRef.current = loadLastRead(userId);
  }, [userId]);

  const markRead = useCallback((threadKey: string) => {
    if (!userId) return;
    lastReadRef.current[threadKey] = Date.now();
    saveLastRead(userId, lastReadRef.current);
    setUnread((u) => (u[threadKey] ? { ...u, [threadKey]: 0 } : u));
  }, [userId]);

  // Clear unread for the currently open thread
  useEffect(() => {
    if (chatOpen && activeThread) markRead(activeThread);
  }, [chatOpen, activeThread, markRead]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`chat_notify_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const m = payload.new as IncomingMsg;
          if (m.sender_id === userId) return;

          // Visibility check (RLS already filters but realtime can leak — re-check)
          const visible =
            m.participants === null ||
            (m.participants && m.participants.includes(userId)) ||
            (m.thread_key.startsWith("dispatch:") && role === "dispatcher");
          if (!visible) return;

          // If chat panel is open on this thread, no notification needed
          if (chatOpen && activeThread === m.thread_key) {
            markRead(m.thread_key);
            return;
          }

          setUnread((u) => ({ ...u, [m.thread_key]: (u[m.thread_key] || 0) + 1 }));
          setFlash((f) => f + 1);

          // Audible "ding-ding" chime
          try {
            const AC = (window.AudioContext || (window as any).webkitAudioContext);
            if (AC) {
              const ctx = new AC();
              const playTone = (freq: number, start: number, dur: number) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = "sine";
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
                g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
                o.connect(g); g.connect(ctx.destination);
                o.start(ctx.currentTime + start);
                o.stop(ctx.currentTime + start + dur + 0.02);
              };
              playTone(880, 0, 0.18);
              playTone(1175, 0.22, 0.22);
              setTimeout(() => ctx.close().catch(() => {}), 800);
            }
          } catch {}

          // Look up sender name
          const { data: prof } = await supabase
            .from("profiles").select("call_sign,full_name").eq("id", m.sender_id).maybeSingle();
          const name = prof?.call_sign || prof?.full_name || "Někdo";
          setLastSenderName(name);

          toast(`✉ Nová zpráva od: ${name}`, { description: m.body.slice(0, 80) });
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(`Nová zpráva od: ${name}`, { body: m.body.slice(0, 120), tag: m.thread_key });
            }
          } catch {}
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, role, chatOpen, activeThread, markRead]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  return { unread, totalUnread, markRead, lastSenderName, flash };
}
