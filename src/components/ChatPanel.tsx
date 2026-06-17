import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Users, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
  /** Pohled: řidič vidí skupinu + každého dispečera; dispečer vidí skupinu + každého řidiče. */
  viewerRole: "driver" | "dispatcher";
}

interface Peer {
  id: string;
  call_sign: string;
  full_name: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  thread_key: string;
  participants: string[] | null;
  body: string;
  created_at: string;
}

interface ThreadDef {
  key: string;
  label: string;
  participants: string[] | null; // null = group
  /** klíč pro filtr příchozích zpráv (skupina) nebo undefined */
  match: (m: ChatMessage) => boolean;
}

function directKey(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `direct:${x}:${y}`;
}

export function ChatPanel({ open, onClose, currentUserId, currentUserName, viewerRole }: ChatPanelProps) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [activeThread, setActiveThread] = useState<string>("group");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Načti seznam protistran: řidiči i dispečeři (kromě sebe).
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles").select("user_id,role").in("role", ["driver", "dispatcher"]);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id))).filter((id) => id !== currentUserId);
      if (!ids.length) { setPeers([]); return; }
      const { data: profs } = await supabase
        .from("profiles").select("id,full_name,call_sign").in("id", ids);
      setPeers((profs ?? []) as Peer[]);
    })();
  }, [open, viewerRole, currentUserId]);

  const threads: ThreadDef[] = useMemo(() => {
    const group: ThreadDef = {
      key: "group",
      label: "🟢 SPOLEČNÝ CHAT",
      participants: null,
      match: (m) => m.thread_key === "group",
    };
    const direct: ThreadDef[] = peers.map((p) => {
      const key = directKey(currentUserId, p.id);
      return {
        key,
        label: `${p.call_sign || p.full_name || "—"}`,
        participants: [currentUserId, p.id].sort(),
        match: (m) => m.thread_key === key,
      };
    });
    return [group, ...direct];
  }, [peers, currentUserId]);

  const currentDef = threads.find((t) => t.key === activeThread) ?? threads[0];

  // Načti zprávy aktivního vlákna + realtime
  useEffect(() => {
    if (!open || !currentDef) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_key", currentDef.key)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled) setMessages((data ?? []) as ChatMessage[]);
    })();

    const ch = supabase
      .channel(`chat_${currentDef.key}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_key=eq.${currentDef.key}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [open, currentDef?.key]);

  // Scroll dolů při nové zprávě
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, activeThread]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !currentDef) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      sender_id: currentUserId,
      thread_key: currentDef.key,
      participants: currentDef.participants,
      body,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setDraft("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1900] bg-black/95 flex flex-col">
      <div className="border-b border-primary/40 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-display text-primary glow-text text-sm">▸ CHAT · {currentUserName}</h2>
        </div>
        <button onClick={onClose} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1">
          <X className="w-3 h-3" /> ZAVŘÍT
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar vláken */}
        <div className="w-20 sm:w-28 border-r border-primary/40 overflow-y-auto shrink-0">
          {threads.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveThread(t.key)}
              className={`w-full text-left px-1.5 py-2 text-[10px] leading-tight border-b border-primary/10 truncate ${
                activeThread === t.key ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:bg-primary/5"
              }`}
            >
              {t.key === "group" ? <Users className="w-3 h-3 inline mr-1" /> : "▸ "}
              {t.label}
            </button>
          ))}
          {threads.length === 1 && (
            <div className="text-[9px] text-muted-foreground p-1.5">
              Žádné chaty.
            </div>
          )}
        </div>


        {/* Bubliny */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-center text-xs text-muted-foreground p-6">Žádné zprávy. Napiš první.</div>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-primary/30 text-foreground rounded-bl-sm"
                  }`}>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={`mt-0.5 text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="border-t border-primary/40 p-2 flex gap-1.5"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Napiš zprávu…"
              autoFocus
              className="flex-1 min-w-0 bg-input border border-primary/40 px-2 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Odeslat"
              className="border border-primary bg-primary text-primary-foreground px-3 py-2 flex items-center justify-center shrink-0 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
