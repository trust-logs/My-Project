-- ERRANDGO PRODUCTION REALTIME HARDENING
-- Run after the existing migrations. Safe to re-run.
-- The web app uses Supabase Postgres Changes for chat; the tables must be in
-- the supabase_realtime publication for database events to reach the browser.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Full replica identity is useful for update/delete event payloads when the
-- client needs old-row values. It is harmless for the chat insert flow.
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Helpful indexes for the exact access paths used by ErrandGo chat/alerts.
CREATE INDEX IF NOT EXISTS conversation_members_user_idx
  ON public.conversation_members(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON public.messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications(user_id, read, created_at DESC);
