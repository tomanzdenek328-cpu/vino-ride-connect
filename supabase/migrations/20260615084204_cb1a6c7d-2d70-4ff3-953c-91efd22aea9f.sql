CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_key text NOT NULL,
  participants uuid[] NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_thread_created_idx ON public.chat_messages (thread_key, created_at DESC);

GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read group or own direct"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (participants IS NULL OR auth.uid() = ANY(participants));

CREATE POLICY "Send as self"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (participants IS NULL OR auth.uid() = ANY(participants))
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;