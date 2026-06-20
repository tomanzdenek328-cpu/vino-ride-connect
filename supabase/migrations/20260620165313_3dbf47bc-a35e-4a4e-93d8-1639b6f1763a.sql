DROP POLICY IF EXISTS "Read group or own direct" ON public.chat_messages;
DROP POLICY IF EXISTS "Send as self" ON public.chat_messages;

CREATE POLICY "chat_read"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    participants IS NULL
    OR auth.uid() = ANY(participants)
    OR (thread_key LIKE 'dispatch:%' AND public.has_role(auth.uid(), 'dispatcher'))
  );

CREATE POLICY "chat_send"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      participants IS NULL
      OR auth.uid() = ANY(participants)
      OR (thread_key LIKE 'dispatch:%' AND public.has_role(auth.uid(), 'dispatcher'))
    )
  );