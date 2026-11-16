-- Phase B.1: additive CampusCommunity friendships. Apply only after reviewing.
-- Requires the installed migration_campus_community.sql; do not rerun it.
-- Existing conversations and direct messages remain unchanged and readable
-- only by their existing participants. They do not imply a friendship.
BEGIN;

DO $$
DECLARE v_name TEXT;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'community_directory', 'community_conversations',
    'community_conversation_participants', 'community_direct_messages',
    'community_blocks', 'community_rate_limits'
  ] LOOP
    IF to_regclass(format('public.%I', v_name)) IS NULL THEN
      RAISE EXCEPTION 'Install the original CampusCommunity migration first; public.% is missing.', v_name;
    END IF;
  END LOOP;
  IF to_regprocedure('public.community_lock_pair(uuid)') IS NULL
    OR to_regprocedure('public.community_require_directory_pair(uuid)') IS NULL
    OR to_regprocedure('public.community_take_limit(text,integer,interval)') IS NULL
    OR to_regprocedure('public.community_start_conversation(uuid)') IS NULL
    OR to_regprocedure('public.community_send_direct_message(uuid,text)') IS NULL
    OR to_regprocedure('public.community_conversation_list()') IS NULL
    OR to_regprocedure('public.community_block_user(uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'The original CampusCommunity functions are required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication
    WHERE pubname = 'supabase_realtime' AND pubinsert AND pubupdate
  ) THEN
    RAISE EXCEPTION 'The supabase_realtime publication must publish INSERT and UPDATE.';
  END IF;
  IF to_regclass('public.community_friend_requests') IS NOT NULL
    OR to_regclass('public.community_friendships') IS NOT NULL THEN
    RAISE EXCEPTION 'Friendship tables already exist; inspect them before installing this migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'community_send_friend_request', 'community_respond_friend_request',
      'community_cancel_friend_request', 'community_unfriend'
    ])
  ) THEN
    RAISE EXCEPTION 'Friendship functions already exist; inspect them before installing this migration.';
  END IF;
END;
$$;

-- A partial unique index permits a new request after a previous one ends but
-- prevents duplicate pending requests in either direction.
CREATE TABLE public.community_friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (requester_id <> recipient_id)
);
CREATE UNIQUE INDEX community_friend_requests_pending_pair_idx
  ON public.community_friend_requests
  (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id))
  WHERE status = 'pending';
CREATE INDEX community_friend_requests_recipient_idx
  ON public.community_friend_requests (recipient_id, status, created_at DESC);
CREATE INDEX community_friend_requests_requester_idx
  ON public.community_friend_requests (requester_id, status, created_at DESC);

-- One sorted pair represents both directions. Inactive rows preserve the
-- relationship record without exposing participant IDs in DELETE events.
CREATE TABLE public.community_friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX community_friendships_user_a_idx ON public.community_friendships (user_a, active);
CREATE INDEX community_friendships_user_b_idx ON public.community_friendships (user_b, active);

ALTER TABLE public.community_friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_friendships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_friend_requests, public.community_friendships
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.community_friend_requests, public.community_friendships TO authenticated;

CREATE POLICY "community friend requests: participants read" ON public.community_friend_requests
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IN (requester_id, recipient_id));
CREATE POLICY "community friendships: participants read" ON public.community_friendships
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IN (user_a, user_b));

-- All changes to a pair use the same advisory lock as blocking and DM sends.
CREATE FUNCTION public.community_send_friend_request(p_other UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request UUID;
BEGIN
  IF auth.uid() IS NULL OR p_other IS NULL OR p_other = auth.uid() THEN
    RAISE EXCEPTION 'Friend request unavailable';
  END IF;
  PERFORM public.community_lock_pair(p_other);
  PERFORM public.community_require_directory_pair(p_other);
  IF EXISTS (
    SELECT 1 FROM public.community_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = p_other)
       OR (blocker_id = p_other AND blocked_id = auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.community_friendships
    WHERE user_a = LEAST(auth.uid(), p_other) AND user_b = GREATEST(auth.uid(), p_other) AND active
  ) THEN RAISE EXCEPTION 'Friend request unavailable'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_friend_requests
    WHERE LEAST(requester_id, recipient_id) = LEAST(auth.uid(), p_other)
      AND GREATEST(requester_id, recipient_id) = GREATEST(auth.uid(), p_other)
      AND status = 'pending'
  ) THEN RAISE EXCEPTION 'A friend request is already pending'; END IF;
  PERFORM public.community_take_limit('friend_request', 20, interval '1 hour');
  INSERT INTO public.community_friend_requests (requester_id, recipient_id)
  VALUES (auth.uid(), p_other) RETURNING id INTO v_request;
  RETURN v_request;
END;
$$;
REVOKE ALL ON FUNCTION public.community_send_friend_request(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_send_friend_request(UUID) TO authenticated;

-- Only the recipient may accept or reject. Opposite simultaneous requests do
-- not automatically accept one another: the first request requires consent.
CREATE FUNCTION public.community_respond_friend_request(p_request UUID, p_accept BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_other UUID;
BEGIN
  IF auth.uid() IS NULL OR p_accept IS NULL THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  SELECT requester_id INTO v_other FROM public.community_friend_requests
  WHERE id = p_request AND recipient_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  PERFORM public.community_lock_pair(v_other);
  PERFORM 1 FROM public.community_friend_requests
  WHERE id = p_request AND requester_id = v_other AND recipient_id = auth.uid()
    AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  IF p_accept THEN
    PERFORM public.community_require_directory_pair(v_other);
    IF EXISTS (
      SELECT 1 FROM public.community_blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = v_other)
         OR (blocker_id = v_other AND blocked_id = auth.uid())
    ) THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  END IF;
  PERFORM public.community_take_limit('friend_action', 60, interval '1 minute');
  IF p_accept THEN
    INSERT INTO public.community_friendships (user_a, user_b)
    VALUES (LEAST(auth.uid(), v_other), GREATEST(auth.uid(), v_other))
    ON CONFLICT (user_a, user_b) DO UPDATE
      SET active = true, updated_at = clock_timestamp();
  END IF;
  UPDATE public.community_friend_requests
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
      updated_at = clock_timestamp()
  WHERE id = p_request;
END;
$$;
REVOKE ALL ON FUNCTION public.community_respond_friend_request(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_respond_friend_request(UUID, BOOLEAN) TO authenticated;

CREATE FUNCTION public.community_cancel_friend_request(p_request UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_other UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  SELECT recipient_id INTO v_other FROM public.community_friend_requests
  WHERE id = p_request AND requester_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  PERFORM public.community_lock_pair(v_other);
  PERFORM public.community_take_limit('friend_action', 60, interval '1 minute');
  UPDATE public.community_friend_requests SET status = 'cancelled', updated_at = clock_timestamp()
  WHERE id = p_request AND requester_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.community_cancel_friend_request(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_cancel_friend_request(UUID) TO authenticated;

CREATE FUNCTION public.community_unfriend(p_other UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR p_other IS NULL OR p_other = auth.uid() THEN
    RAISE EXCEPTION 'Friendship unavailable';
  END IF;
  PERFORM public.community_lock_pair(p_other);
  PERFORM public.community_take_limit('friend_action', 60, interval '1 minute');
  UPDATE public.community_friendships SET active = false, updated_at = clock_timestamp()
  WHERE user_a = LEAST(auth.uid(), p_other) AND user_b = GREATEST(auth.uid(), p_other) AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Friendship unavailable'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.community_unfriend(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_unfriend(UUID) TO authenticated;

-- Preserve the existing signature and behavior, adding the friendship check
-- while holding the same pair lock used by unfriending and blocking.
CREATE OR REPLACE FUNCTION public.community_start_conversation(p_other UUID)
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
  ) OR NOT EXISTS (
    SELECT 1 FROM public.community_friendships
    WHERE user_a = LEAST(auth.uid(), p_other) AND user_b = GREATEST(auth.uid(), p_other) AND active
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

CREATE OR REPLACE FUNCTION public.community_send_direct_message(p_conversation UUID, p_content TEXT)
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
  ) OR NOT EXISTS (
    SELECT 1 FROM public.community_friendships
    WHERE user_a = LEAST(auth.uid(), v_other) AND user_b = GREATEST(auth.uid(), v_other) AND active
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

-- Blocking also ends the friendship and closes any pending request. Unblocking
-- never recreates either; the students must mutually establish friendship again.
CREATE OR REPLACE FUNCTION public.community_block_user(p_other UUID, p_block BOOLEAN)
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
    UPDATE public.community_friendships SET active = false, updated_at = clock_timestamp()
    WHERE user_a = LEAST(auth.uid(), p_other) AND user_b = GREATEST(auth.uid(), p_other) AND active;
    UPDATE public.community_friend_requests SET status = 'cancelled', updated_at = clock_timestamp()
    WHERE LEAST(requester_id, recipient_id) = LEAST(auth.uid(), p_other)
      AND GREATEST(requester_id, recipient_id) = GREATEST(auth.uid(), p_other)
      AND status = 'pending';
  ELSE
    DELETE FROM public.community_blocks WHERE blocker_id = auth.uid() AND blocked_id = p_other;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.community_block_user(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_block_user(UUID, BOOLEAN) TO authenticated;

-- Keep the existing result signature so the old conversation list continues
-- to include readable history. can_message now also requires friendship.
CREATE OR REPLACE FUNCTION public.community_conversation_list()
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
    AND EXISTS (
      SELECT 1 FROM public.community_friendships f
      WHERE f.user_a = LEAST(auth.uid(), peer.id) AND f.user_b = GREATEST(auth.uid(), peer.id) AND f.active
    )
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

-- Only INSERT/UPDATE listeners are used. Supabase cannot apply row-level
-- security to DELETE events, which may expose deleted primary-key identifiers.
DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['community_friend_requests', 'community_friendships']
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
