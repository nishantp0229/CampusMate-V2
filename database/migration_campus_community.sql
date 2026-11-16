-- CampusCommunity. Review before running; this migration is not applied by the app.
-- Requires database/schema.sql and database/migration_admin_academic.sql.
-- This is a first-install migration. It fails on conflicting community objects
-- rather than replacing them. Postgres Changes still checks each table's RLS.
BEGIN;

DO $$
DECLARE v_name TEXT;
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'The base schema and Phase A admin migration are required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attname = 'id'
      AND atttypid = 'uuid'::regtype AND attnum > 0 AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attname = 'full_name'
      AND atttypid IN ('text'::regtype, 'varchar'::regtype)
      AND attnum > 0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'CampusCommunity requires profiles.id UUID and profiles.full_name TEXT or VARCHAR.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.is_admin()'::regprocedure AND prorettype = 'boolean'::regtype
  ) THEN
    RAISE EXCEPTION 'Phase A public.is_admin() must return BOOLEAN.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication
    WHERE pubname = 'supabase_realtime' AND pubinsert AND pubupdate
  ) THEN
    RAISE EXCEPTION 'The supabase_realtime publication must exist and publish INSERT and UPDATE.';
  END IF;
  IF to_regclass('realtime.messages') IS NULL OR to_regprocedure('realtime.topic()') IS NULL THEN
    RAISE EXCEPTION 'Supabase Realtime messages and topic() are required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'realtime.messages'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS must be enabled on realtime.messages before installing CampusCommunity.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname = ANY (ARRAY[
        'campuscommunity: receive own private topic',
        'campuscommunity: restrict topic reads',
        'campuscommunity: block topic writes'
      ])
  ) OR EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'community_sync_profile_name' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'An existing CampusCommunity Realtime policy or profile trigger conflicts with this migration; inspect it before proceeding.';
  END IF;

  -- Never silently adopt or overwrite an existing installation or overload.
  FOREACH v_name IN ARRAY ARRAY[
    'community_directory', 'community_channels', 'community_messages',
    'community_conversations', 'community_conversation_participants',
    'community_direct_messages', 'community_blocks', 'community_reports',
    'community_moderation_log', 'community_rate_limits'
  ] LOOP
    IF to_regclass(format('public.%I', v_name)) IS NOT NULL THEN
      RAISE EXCEPTION 'Existing public.% conflicts with this first-install migration; inspect it before proceeding.', v_name;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'community_take_limit', 'community_lock_pair', 'community_require_directory_pair',
      'community_join_directory', 'community_leave_directory', 'community_sync_profile_name',
      'community_send_message', 'community_edit_message', 'community_delete_message',
      'community_start_conversation', 'community_send_direct_message', 'community_block_user',
      'community_mark_read', 'community_conversation_list', 'community_report_message',
      'community_review_report'
    ])
  ) THEN
    RAISE EXCEPTION 'An existing CampusCommunity function conflicts with this first-install migration; inspect it before proceeding.';
  END IF;
END;
$$;

-- Only students who opt in appear here. No email or private profile fields.
CREATE TABLE public.community_directory (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX community_directory_name_idx ON public.community_directory (lower(display_name));

CREATE TABLE public.community_channels (
  slug TEXT PRIMARY KEY,
  description TEXT NOT NULL
);
INSERT INTO public.community_channels (slug, description) VALUES
  ('general', 'Everyday campus conversation'),
  ('academics', 'Classes, coursework and study'),
  ('coding', 'Code, projects and questions'),
  ('hackathons', 'Build together and share opportunities'),
  ('campus-events', 'What is happening around campus');

CREATE TABLE public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_slug TEXT NOT NULL REFERENCES public.community_channels(slug),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL CHECK (char_length(sender_name) BETWEEN 1 AND 100),
  content TEXT,
  reply_to UUID REFERENCES public.community_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CHECK (
    (deleted_at IS NULL AND content IS NOT NULL AND char_length(content) BETWEEN 1 AND 2000 AND content ~ '[^[:space:]]')
    OR (deleted_at IS NOT NULL AND content IS NULL)
  )
);
CREATE INDEX community_messages_channel_history_idx
  ON public.community_messages (channel_slug, created_at DESC, id DESC);

-- The sorted pair makes duplicate one-to-one conversations impossible.
CREATE TABLE public.community_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX community_conversations_user_a_idx ON public.community_conversations (user_a, updated_at DESC);
CREATE INDEX community_conversations_user_b_idx ON public.community_conversations (user_b, updated_at DESC);

CREATE TABLE public.community_conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.community_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity'::timestamptz,
  last_read_message_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.community_direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.community_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000 AND content ~ '[^[:space:]]'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX community_direct_messages_history_idx
  ON public.community_direct_messages (conversation_id, created_at DESC, id DESC);

CREATE TABLE public.community_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX community_blocks_blocked_idx ON public.community_blocks (blocked_id, blocker_id);

-- Private reports contain the reporter's reason, not a copied DM.
CREATE TABLE public.community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('public', 'direct')),
  public_message_id UUID REFERENCES public.community_messages(id) ON DELETE CASCADE,
  direct_message_id UUID REFERENCES public.community_direct_messages(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500 AND reason ~ '[^[:space:]]'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (kind = 'public' AND public_message_id IS NOT NULL AND direct_message_id IS NULL)
    OR (kind = 'direct' AND direct_message_id IS NOT NULL AND public_message_id IS NULL)
  )
);
CREATE UNIQUE INDEX community_reports_public_once_idx
  ON public.community_reports (reporter_id, public_message_id) WHERE public_message_id IS NOT NULL;
CREATE UNIQUE INDEX community_reports_direct_once_idx
  ON public.community_reports (reporter_id, direct_message_id) WHERE direct_message_id IS NOT NULL;
CREATE INDEX community_reports_status_idx ON public.community_reports (status, created_at DESC);

CREATE TABLE public.community_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.community_messages(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action = 'delete_public_message'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Internal, transactionally locked rate-limit buckets.
CREATE TABLE public.community_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 0),
  PRIMARY KEY (user_id, bucket)
);

ALTER TABLE public.community_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_rate_limits ENABLE ROW LEVEL SECURITY;

-- No client can write these tables directly. Trusted RPCs derive auth.uid().
REVOKE ALL ON public.community_directory, public.community_channels,
  public.community_messages, public.community_conversations,
  public.community_conversation_participants, public.community_direct_messages,
  public.community_blocks, public.community_reports, public.community_moderation_log,
  public.community_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, display_name) ON public.community_directory TO authenticated;
GRANT SELECT ON public.community_channels, public.community_messages, public.community_conversations,
  public.community_conversation_participants, public.community_direct_messages,
  public.community_blocks, public.community_reports, public.community_moderation_log
  TO authenticated;

CREATE POLICY "community directory: authenticated read" ON public.community_directory
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "community channels: authenticated read" ON public.community_channels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "community messages: authenticated read" ON public.community_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "community conversations: participants read" ON public.community_conversations
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IN (user_a, user_b));
CREATE POLICY "community participants: read own marker" ON public.community_conversation_participants
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "community direct messages: participants read" ON public.community_direct_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.community_conversations c
      WHERE c.id = community_direct_messages.conversation_id
        AND (SELECT auth.uid()) IN (c.user_a, c.user_b)
    )
  );
CREATE POLICY "community blocks: read own" ON public.community_blocks
  FOR SELECT TO authenticated USING (blocker_id = (SELECT auth.uid()));
CREATE POLICY "community reports: reporter or admin" ON public.community_reports
  FOR SELECT TO authenticated USING (reporter_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY "community moderation log: admins" ON public.community_moderation_log
  FOR SELECT TO authenticated USING (public.is_admin());

-- Internal helpers are not executable by clients.
CREATE FUNCTION public.community_take_limit(p_bucket TEXT, p_max INTEGER, p_window INTERVAL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_used INTEGER; v_started TIMESTAMPTZ; v_now TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.community_rate_limits (user_id, bucket, window_started_at, used)
  VALUES (auth.uid(), p_bucket, clock_timestamp(), 0)
  ON CONFLICT (user_id, bucket) DO NOTHING;
  SELECT window_started_at, used INTO v_started, v_used
  FROM public.community_rate_limits WHERE user_id = auth.uid() AND bucket = p_bucket FOR UPDATE;
  v_now := clock_timestamp();
  IF v_started + p_window <= v_now THEN
    v_started := v_now;
    v_used := 0;
  END IF;
  IF v_used >= p_max THEN RAISE EXCEPTION 'Too many requests. Please try again later.'; END IF;
  UPDATE public.community_rate_limits SET window_started_at = v_started, used = v_used + 1
  WHERE user_id = auth.uid() AND bucket = p_bucket;
END;
$$;
REVOKE ALL ON FUNCTION public.community_take_limit(TEXT, INTEGER, INTERVAL) FROM PUBLIC, anon, authenticated;

-- Serialize block, conversation creation and sending for the same pair.
CREATE FUNCTION public.community_lock_pair(p_other UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR p_other IS NULL OR p_other = auth.uid() THEN
    RAISE EXCEPTION 'Invalid conversation';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    LEAST(auth.uid(), p_other)::text || ':' || GREATEST(auth.uid(), p_other)::text, 0
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.community_lock_pair(UUID) FROM PUBLIC, anon, authenticated;

-- Prevent a concurrent directory opt-out from racing a new conversation/send.
CREATE FUNCTION public.community_require_directory_pair(p_other UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.community_directory
  WHERE user_id = LEAST(auth.uid(), p_other) FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
  PERFORM 1 FROM public.community_directory
  WHERE user_id = GREATEST(auth.uid(), p_other) FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.community_require_directory_pair(UUID) FROM PUBLIC, anon, authenticated;

-- The public name is always taken from the signed-in user's private profile.
CREATE FUNCTION public.community_join_directory()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM public.community_take_limit('directory', 10, interval '1 minute');
  SELECT left(btrim(full_name), 100) INTO v_name
  FROM public.profiles WHERE id = auth.uid() FOR SHARE;
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'Add your name to your profile before joining CampusCommunity.';
  END IF;
  INSERT INTO public.community_directory (user_id, display_name)
  VALUES (auth.uid(), v_name)
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;
END;
$$;
REVOKE ALL ON FUNCTION public.community_join_directory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_join_directory() TO authenticated;

CREATE FUNCTION public.community_leave_directory()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM public.community_take_limit('directory', 10, interval '1 minute');
  DELETE FROM public.community_directory WHERE user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.community_leave_directory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_leave_directory() TO authenticated;

CREATE FUNCTION public.community_sync_profile_name()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.community_directory
  SET display_name = COALESCE(NULLIF(left(btrim(NEW.full_name), 100), ''), 'Student')
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.community_sync_profile_name() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER community_sync_profile_name AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.community_sync_profile_name();

CREATE FUNCTION public.community_send_message(p_channel TEXT, p_content TEXT, p_reply_to UUID DEFAULT NULL)
RETURNS public.community_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_name TEXT; v_message public.community_messages;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT display_name INTO v_name FROM public.community_directory WHERE user_id = auth.uid() FOR KEY SHARE;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Join the community before posting.'; END IF;
  IF p_content IS NULL OR char_length(btrim(p_content)) NOT BETWEEN 1 AND 2000 OR p_content !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Messages must contain 1 to 2000 characters.';
  END IF;
  IF p_reply_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.community_messages WHERE id = p_reply_to AND channel_slug = p_channel
  ) THEN RAISE EXCEPTION 'The reply is not in this channel.'; END IF;
  PERFORM public.community_take_limit('message', 20, interval '1 minute');
  INSERT INTO public.community_messages (channel_slug, sender_id, sender_name, content, reply_to)
  VALUES (p_channel, auth.uid(), v_name, btrim(p_content), p_reply_to)
  RETURNING * INTO v_message;
  RETURN v_message;
END;
$$;
REVOKE ALL ON FUNCTION public.community_send_message(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_send_message(TEXT, TEXT, UUID) TO authenticated;

CREATE FUNCTION public.community_edit_message(p_message_id UUID, p_content TEXT)
RETURNS public.community_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_message public.community_messages;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_content IS NULL OR char_length(btrim(p_content)) NOT BETWEEN 1 AND 2000 OR p_content !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Messages must contain 1 to 2000 characters.';
  END IF;
  PERFORM public.community_take_limit('message', 20, interval '1 minute');
  UPDATE public.community_messages SET content = btrim(p_content), edited_at = clock_timestamp()
  WHERE id = p_message_id AND sender_id = auth.uid() AND deleted_at IS NULL
  RETURNING * INTO v_message;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found or access denied'; END IF;
  RETURN v_message;
END;
$$;
REVOKE ALL ON FUNCTION public.community_edit_message(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_edit_message(UUID, TEXT) TO authenticated;

CREATE FUNCTION public.community_delete_message(p_message_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner UUID; v_deleted TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT sender_id, deleted_at INTO v_owner, v_deleted
  FROM public.community_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND OR (v_owner <> auth.uid() AND public.is_admin() IS NOT TRUE) THEN
    RAISE EXCEPTION 'Message not found or access denied';
  END IF;
  IF v_deleted IS NOT NULL THEN RETURN; END IF;
  UPDATE public.community_messages SET content = NULL, deleted_at = clock_timestamp(), edited_at = NULL
  WHERE id = p_message_id;
  IF v_owner <> auth.uid() THEN
    INSERT INTO public.community_moderation_log (admin_id, message_id, action)
    VALUES (auth.uid(), p_message_id, 'delete_public_message');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.community_delete_message(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_delete_message(UUID) TO authenticated;

CREATE FUNCTION public.community_start_conversation(p_other UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_conversation UUID;
BEGIN
  IF auth.uid() IS NULL OR p_other IS NULL OR p_other = auth.uid() THEN
    RAISE EXCEPTION 'Conversation unavailable';
  END IF;
  PERFORM public.community_lock_pair(p_other);
  PERFORM public.community_require_directory_pair(p_other);
  IF EXISTS (
      SELECT 1 FROM public.community_blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = p_other)
         OR (blocker_id = p_other AND blocked_id = auth.uid())
    ) THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
  PERFORM public.community_take_limit('conversation', 20, interval '1 minute');
  INSERT INTO public.community_conversations (user_a, user_b)
  VALUES (LEAST(auth.uid(), p_other), GREATEST(auth.uid(), p_other))
  ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = EXCLUDED.user_a
  RETURNING id INTO v_conversation;
  INSERT INTO public.community_conversation_participants (conversation_id, user_id)
  VALUES (v_conversation, auth.uid()), (v_conversation, p_other)
  ON CONFLICT DO NOTHING;
  RETURN v_conversation;
END;
$$;
REVOKE ALL ON FUNCTION public.community_start_conversation(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_start_conversation(UUID) TO authenticated;

CREATE FUNCTION public.community_send_direct_message(p_conversation UUID, p_content TEXT)
RETURNS public.community_direct_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_other UUID; v_previous TIMESTAMPTZ; v_message public.community_direct_messages;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT CASE WHEN user_a = auth.uid() THEN user_b ELSE user_a END INTO v_other
  FROM public.community_conversations
  WHERE id = p_conversation AND auth.uid() IN (user_a, user_b);
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
  PERFORM public.community_lock_pair(v_other);
  PERFORM public.community_require_directory_pair(v_other);
  IF EXISTS (
    SELECT 1 FROM public.community_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = v_other)
       OR (blocker_id = v_other AND blocked_id = auth.uid())
  ) THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
  IF p_content IS NULL OR char_length(btrim(p_content)) NOT BETWEEN 1 AND 2000 OR p_content !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Messages must contain 1 to 2000 characters.';
  END IF;
  PERFORM public.community_take_limit('message', 20, interval '1 minute');
  SELECT updated_at INTO v_previous FROM public.community_conversations WHERE id = p_conversation;
  INSERT INTO public.community_direct_messages (conversation_id, sender_id, content, created_at)
  VALUES (p_conversation, auth.uid(), btrim(p_content),
    GREATEST(clock_timestamp(), v_previous + interval '1 microsecond')) RETURNING * INTO v_message;
  UPDATE public.community_conversations SET updated_at = v_message.created_at WHERE id = p_conversation;
  RETURN v_message;
END;
$$;
REVOKE ALL ON FUNCTION public.community_send_direct_message(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_send_direct_message(UUID, TEXT) TO authenticated;

CREATE FUNCTION public.community_block_user(p_other UUID, p_block BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR p_other IS NULL OR p_other = auth.uid() OR p_block IS NULL THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;
  PERFORM public.community_lock_pair(p_other);
  IF p_block AND NOT EXISTS (SELECT 1 FROM public.community_directory WHERE user_id = p_other) THEN
    RAISE EXCEPTION 'User unavailable';
  END IF;
  PERFORM public.community_take_limit('block', 20, interval '1 minute');
  IF p_block THEN
    INSERT INTO public.community_blocks (blocker_id, blocked_id)
    VALUES (auth.uid(), p_other) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.community_blocks WHERE blocker_id = auth.uid() AND blocked_id = p_other;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.community_block_user(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_block_user(UUID, BOOLEAN) TO authenticated;

-- Mark only a message the caller can actually see; never accept an arbitrary timestamp.
CREATE FUNCTION public.community_mark_read(p_conversation UUID, p_message UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT m.created_at INTO v_at
  FROM public.community_direct_messages m
  JOIN public.community_conversations c ON c.id = m.conversation_id
  WHERE m.id = p_message AND m.conversation_id = p_conversation
    AND auth.uid() IN (c.user_a, c.user_b);
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found or access denied'; END IF;
  UPDATE public.community_conversation_participants
  SET last_read_at = v_at, last_read_message_id = p_message
  WHERE conversation_id = p_conversation AND user_id = auth.uid()
    AND (last_read_at, last_read_message_id) < (v_at, p_message);
END;
$$;
REVOKE ALL ON FUNCTION public.community_mark_read(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_mark_read(UUID, UUID) TO authenticated;

CREATE FUNCTION public.community_conversation_list()
RETURNS TABLE (
  conversation_id UUID, peer_id UUID, peer_name TEXT, last_content TEXT,
  last_message_at TIMESTAMPTZ, unread_count BIGINT, blocked_by_me BOOLEAN, can_message BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' STABLE AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN QUERY
  SELECT c.id, peer.id, COALESCE(d.display_name, 'Student'),
    latest.content, COALESCE(latest.created_at, c.created_at),
    (SELECT COUNT(*) FROM public.community_direct_messages m
     WHERE m.conversation_id = c.id AND m.sender_id <> auth.uid()
       AND (m.created_at, m.id) > (mine.last_read_at, mine.last_read_message_id)),
    EXISTS (SELECT 1 FROM public.community_blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = peer.id),
    EXISTS (SELECT 1 FROM public.community_directory own_entry WHERE own_entry.user_id = auth.uid())
    AND d.user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.community_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = peer.id)
         OR (b.blocker_id = peer.id AND b.blocked_id = auth.uid()))
  FROM public.community_conversations c
  JOIN public.community_conversation_participants mine
    ON mine.conversation_id = c.id AND mine.user_id = auth.uid()
  CROSS JOIN LATERAL (SELECT CASE WHEN c.user_a = auth.uid() THEN c.user_b ELSE c.user_a END AS id) peer
  LEFT JOIN public.community_directory d ON d.user_id = peer.id
  LEFT JOIN LATERAL (
    SELECT m.content, m.created_at FROM public.community_direct_messages m
    WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1
  ) latest ON true
  WHERE auth.uid() IN (c.user_a, c.user_b)
  ORDER BY c.updated_at DESC, c.id DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.community_conversation_list() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_conversation_list() TO authenticated;

CREATE FUNCTION public.community_report_message(p_kind TEXT, p_message UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_sender UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 OR p_reason !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Provide a reason of up to 500 characters.';
  END IF;
  IF p_kind = 'public' THEN
    SELECT sender_id INTO v_sender FROM public.community_messages
    WHERE id = p_message AND deleted_at IS NULL;
  ELSIF p_kind = 'direct' THEN
    SELECT m.sender_id INTO v_sender FROM public.community_direct_messages m
    JOIN public.community_conversations c ON c.id = m.conversation_id
    WHERE m.id = p_message AND auth.uid() IN (c.user_a, c.user_b);
  ELSE RAISE EXCEPTION 'Invalid report'; END IF;
  IF v_sender IS NULL OR v_sender = auth.uid() THEN RAISE EXCEPTION 'Message unavailable'; END IF;
  PERFORM public.community_take_limit('report', 10, interval '1 hour');
  INSERT INTO public.community_reports (reporter_id, reported_user_id, kind, public_message_id, direct_message_id, reason)
  VALUES (auth.uid(), v_sender, p_kind,
    CASE WHEN p_kind = 'public' THEN p_message END,
    CASE WHEN p_kind = 'direct' THEN p_message END, btrim(p_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.community_report_message(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_report_message(TEXT, UUID, TEXT) TO authenticated;

CREATE FUNCTION public.community_review_report(p_report UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF p_status NOT IN ('reviewed', 'dismissed') OR p_status IS NULL THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.community_reports SET status = p_status, reviewed_by = auth.uid(), reviewed_at = clock_timestamp()
  WHERE id = p_report AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found or already reviewed'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.community_review_report(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_review_report(UUID, TEXT) TO authenticated;

-- Private Realtime topics are scoped to the authenticated account. The
-- permissive policy allows the app to join; restrictive policies are ANDed
-- with all existing permissive policies, for every role subject to RLS.
-- No client-originated broadcasts or presence are needed for this namespace.
-- Other topics keep their existing policies. Public channels bypass these
-- checks: disable Realtime's "Allow public access" setting before use.
CREATE POLICY "campuscommunity: receive own private topic" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND (SELECT realtime.topic()) = 'campuscommunity:user:' || (SELECT auth.uid())::text
  );

CREATE POLICY "campuscommunity: restrict topic reads" ON realtime.messages
  AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (
    (
      COALESCE((SELECT realtime.topic()), '') NOT LIKE 'campuscommunity:user:%'
      AND COALESCE(topic, '') NOT LIKE 'campuscommunity:user:%'
    )
    OR (
      extension = 'broadcast'
      AND current_user = 'authenticated'
      AND (SELECT realtime.topic()) = 'campuscommunity:user:' || (SELECT auth.uid())::text
      AND topic = (SELECT realtime.topic())
    )
  );

CREATE POLICY "campuscommunity: block topic writes" ON realtime.messages
  AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (
    COALESCE((SELECT realtime.topic()), '') NOT LIKE 'campuscommunity:user:%'
    AND COALESCE(topic, '') NOT LIKE 'campuscommunity:user:%'
  );

DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['community_messages', 'community_conversations', 'community_direct_messages']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END;
$$;

COMMIT;
