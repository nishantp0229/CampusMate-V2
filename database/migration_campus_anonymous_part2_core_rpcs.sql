-- =============================================================
-- CAMPUSMATE — CAMPUSANONYMOUS PRODUCTION MIGRATION
-- PART 2 OF 3: CORE MATCHMAKING, CHAT, SAFETY & MODERATION RPCS
-- =============================================================
-- Audience: Production Supabase project (run AFTER Part 1)
-- Safe for execution via Supabase Dashboard SQL Editor (~22 KB).
-- Wrapped in an explicit transaction block: rolls back on any error.
--
-- Contents:
--   - Preflight dependency verification: confirms Part 1 schema exists
--   - 11 Core SECURITY DEFINER RPC functions:
--       1a. anonymous_join_or_match()
--       1b. anonymous_check_match()
--       1c. anonymous_get_room_info()
--       1d. anonymous_get_messages()
--       1e. anonymous_heartbeat()
--       1f. anonymous_leave()
--       1g. anonymous_send_message()
--       1h. anonymous_block_partner()
--       1i. anonymous_report_partner()
--       1j. anonymous_admin_review_report()
--       1k. anonymous_admin_get_report_transcript()
--   - Explicit execution grants for core RPCs
--   - Supabase Realtime publication configuration for anonymous_messages
-- =============================================================

BEGIN;

-- ─── 0. PREFLIGHT DEPENDENCY CHECK (PART 1 REQUIRED) ──────────
DO $$
DECLARE
  v_table TEXT;
BEGIN
  -- Verify all 9 tables from Part 1 exist
  FOREACH v_table IN ARRAY ARRAY[
    'anonymous_queue',
    'anonymous_rooms',
    'anonymous_messages',
    'anonymous_blocks',
    'anonymous_reports',
    'anonymous_rate_limits',
    'anonymous_video_sessions',
    'anonymous_signals',
    'anonymous_active_participants'
  ] LOOP
    IF pg_catalog.to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Part 2 requires table public.%. Run Part 1 first.', v_table;
    END IF;
  END LOOP;

  -- Verify active-participants trigger exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.anonymous_rooms'::regclass
      AND tgname = 'anonymous_sync_active_participants'
      AND tgenabled IN ('O', 'A')
  ) THEN
    RAISE EXCEPTION 'Part 2 requires active-participant trigger on anonymous_rooms. Run Part 1 first.';
  END IF;

  -- Verify helper functions from Part 1 exist
  IF pg_catalog.to_regprocedure('public.anonymous_is_room_participant(uuid)') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_check_rate_limit(uuid,text,integer,interval)') IS NULL THEN
    RAISE EXCEPTION 'Part 2 requires Part 1 helper functions. Run Part 1 first.';
  END IF;
END;
$$;


-- ─── 1. RPC FUNCTIONS ────────────────────────────────────────

-- ── 1a. join_or_match ────────────────────────────────────────
-- Atomically joins queue or matches with an existing waiting partner.
-- Returns alias-safe JSONB only — zero student UUIDs exposed.
CREATE FUNCTION public.anonymous_join_or_match()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid           UUID;
  v_partner_id    UUID;
  v_room_id       UUID;
  v_alias_caller  TEXT;
  v_alias_partner TEXT;
  v_u1 UUID; v_u2 UUID;
  v_u1_alias TEXT; v_u2_alias TEXT;
  v_aliases TEXT[] := ARRAY[
    'Shadow Hawk',   'Cosmic Otter',  'Neon Falcon',   'Starlight Fox',
    'Quantum Badger','Cyber Lynx',    'Solar Phoenix',  'Lunar Panther',
    'Astral Griffin','Echo Dolphin',  'Vortex Wolf',    'Pixel Owl',
    'Hyper Cheetah', 'Prism Tiger',   'Velocity Raven', 'Nebula Bear'
  ];
  v_idx1 INT; v_idx2 INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous matchmaking requires READ COMMITTED isolation.';
  END IF;

  -- Transaction-level advisory lock serializes room lifecycle operations
  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);

  -- Rate limit: max 5 matchmaking requests per 60 seconds
  IF NOT public.anonymous_check_rate_limit(
       v_uid, 'matchmaking', 5, INTERVAL '60 seconds') THEN
    RAISE EXCEPTION 'Too many matchmaking requests. Wait a moment and try again.';
  END IF;

  -- End any active room caller is currently in
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
  WHERE (user_1 = v_uid OR user_2 = v_uid) AND status = 'active';

  -- Prune dead queue entries (>60s heartbeat)
  DELETE FROM public.anonymous_queue
  WHERE heartbeat < pg_catalog.now() - INTERVAL '60 seconds';

  -- Prune abandoned active rooms older than 2 hours
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now()
  WHERE status = 'active'
    AND created_at < pg_catalog.now() - INTERVAL '2 hours';

  -- Concurrency-safe partner search
  SELECT q.user_id INTO v_partner_id
  FROM public.anonymous_queue q
  WHERE q.user_id <> v_uid
    -- Skip mutually blocked users
    AND NOT EXISTS (
      SELECT 1 FROM public.anonymous_blocks b
      WHERE (b.blocker_id = v_uid       AND b.blocked_id  = q.user_id)
         OR (b.blocker_id = q.user_id   AND b.blocked_id  = v_uid)
    )
    -- Skip candidates currently in an active room
    AND NOT EXISTS (
      SELECT 1 FROM public.anonymous_active_participants ap
      WHERE ap.user_id = q.user_id
    )
  ORDER BY q.joined_at ASC
  FOR UPDATE OF q SKIP LOCKED
  LIMIT 1;

  IF v_partner_id IS NOT NULL THEN
    -- Match found: remove both from waiting queue
    DELETE FROM public.anonymous_queue
    WHERE user_id IN (v_partner_id, v_uid);

    -- Generate two distinct aliases
    v_idx1 := 1 + (pg_catalog.floor(
                     pg_catalog.random() * pg_catalog.cardinality(v_aliases)
                   ))::int;
    v_idx2 := 1 + (pg_catalog.floor(
                     pg_catalog.random() * (pg_catalog.cardinality(v_aliases) - 1)
                   ))::int;
    IF v_idx2 >= v_idx1 THEN v_idx2 := v_idx2 + 1; END IF;

    v_alias_caller  := v_aliases[v_idx1];
    v_alias_partner := v_aliases[v_idx2];

    -- Canonical ordering: user_1 < user_2
    IF v_uid < v_partner_id THEN
      v_u1 := v_uid;         v_u2 := v_partner_id;
      v_u1_alias := v_alias_caller; v_u2_alias := v_alias_partner;
    ELSE
      v_u1 := v_partner_id;  v_u2 := v_uid;
      v_u1_alias := v_alias_partner; v_u2_alias := v_alias_caller;
    END IF;

    INSERT INTO public.anonymous_rooms
      (user_1, user_2, user_1_alias, user_2_alias, status)
    VALUES (v_u1, v_u2, v_u1_alias, v_u2_alias, 'active')
    RETURNING id INTO v_room_id;

    RETURN pg_catalog.jsonb_build_object(
      'matched',        true,
      'room_id',        v_room_id,
      'my_alias',       v_alias_caller,
      'partner_alias',  v_alias_partner
    );
  ELSE
    -- No partner available: register in queue
    INSERT INTO public.anonymous_queue (user_id, joined_at, heartbeat)
    VALUES (v_uid, pg_catalog.now(), pg_catalog.now())
    ON CONFLICT (user_id) DO UPDATE SET heartbeat = pg_catalog.now();

    RETURN pg_catalog.jsonb_build_object(
      'matched', false,
      'status',  'waiting'
    );
  END IF;
END;
$$;


-- ── 1b. check_match ─────────────────────────────────────────
-- Polling endpoint: returns match status without exposing partner UUID.
CREATE FUNCTION public.anonymous_check_match()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        UUID;
  v_room       RECORD;
  v_my_alias   TEXT;
  v_part_alias TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous match checks require READ COMMITTED isolation.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);

  SELECT * INTO v_room
  FROM public.anonymous_rooms
  WHERE (user_1 = v_uid OR user_2 = v_uid) AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_room.user_1 = v_uid THEN
      v_my_alias   := v_room.user_1_alias;
      v_part_alias := v_room.user_2_alias;
    ELSE
      v_my_alias   := v_room.user_2_alias;
      v_part_alias := v_room.user_1_alias;
    END IF;
    DELETE FROM public.anonymous_queue WHERE user_id = v_uid;
    RETURN pg_catalog.jsonb_build_object(
      'matched',       true,
      'room_id',       v_room.id,
      'my_alias',      v_my_alias,
      'partner_alias', v_part_alias
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.anonymous_queue WHERE user_id = v_uid) THEN
    RETURN pg_catalog.jsonb_build_object('matched', false, 'status', 'waiting');
  END IF;
  RETURN pg_catalog.jsonb_build_object('matched', false, 'status', 'idle');
END;
$$;


-- ── 1c. get_room_info ───────────────────────────────────────
-- Returns alias-safe room metadata for the calling participant.
CREATE FUNCTION public.anonymous_get_room_info(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        UUID;
  v_room       RECORD;
  v_my_alias   TEXT;
  v_part_alias TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_room
  FROM public.anonymous_rooms
  WHERE id = p_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found.';
  END IF;

  IF v_room.user_1 = v_uid THEN
    v_my_alias   := v_room.user_1_alias;
    v_part_alias := v_room.user_2_alias;
  ELSIF v_room.user_2 = v_uid THEN
    v_my_alias   := v_room.user_2_alias;
    v_part_alias := v_room.user_1_alias;
  ELSE
    RAISE EXCEPTION 'You are not a participant in this room.';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'room_id',       v_room.id,
    'my_alias',      v_my_alias,
    'partner_alias', v_part_alias,
    'my_role',       CASE WHEN v_room.user_1 = v_uid THEN 'user_1' ELSE 'user_2' END,
    'status',        v_room.status
  );
END;
$$;


-- ── 1d. get_messages ────────────────────────────────────────
-- Returns message history for a room WITHOUT student UUIDs.
CREATE FUNCTION public.anonymous_get_messages(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID;
  v_room   RECORD;
  v_result JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_room FROM public.anonymous_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found.';
  END IF;
  IF v_room.user_1 <> v_uid AND v_room.user_2 <> v_uid THEN
    RAISE EXCEPTION 'You are not a participant in this room.';
  END IF;

  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id',           m.id,
      'room_id',      m.room_id,
      'sender_role',  m.sender_role,
      'sender_alias', m.sender_alias,
      'is_self',      (CASE WHEN v_room.user_1 = v_uid THEN m.sender_role = 'user_1' ELSE m.sender_role = 'user_2' END),
      'content',      m.content,
      'created_at',   m.created_at
    )
    ORDER BY m.created_at ASC
  )
  INTO v_result
  FROM public.anonymous_messages m
  WHERE m.room_id = p_room_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- ── 1e. heartbeat ───────────────────────────────────────────
CREATE FUNCTION public.anonymous_heartbeat()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  IF NOT public.anonymous_check_rate_limit(
       v_uid, 'heartbeat', 10, INTERVAL '10 seconds') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.anonymous_queue
  SET heartbeat = pg_catalog.now()
  WHERE user_id = v_uid;
  RETURN FOUND;
END;
$$;


-- ── 1f. leave ───────────────────────────────────────────────
CREATE FUNCTION public.anonymous_leave(p_room_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous leave requires READ COMMITTED isolation.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);

  IF p_room_id IS NOT NULL THEN
    -- Leaving a specific room: only end that room; do NOT delete any newer queue entry
    UPDATE public.anonymous_rooms
    SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
    WHERE id = p_room_id
      AND (user_1 = v_uid OR user_2 = v_uid)
      AND status = 'active';
  ELSE
    -- Unscoped exit (Stop / leaving queue entirely):
    DELETE FROM public.anonymous_queue WHERE user_id = v_uid;

    UPDATE public.anonymous_rooms
    SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
    WHERE (user_1 = v_uid OR user_2 = v_uid) AND status = 'active';
  END IF;

  -- Messages are intentionally preserved for abuse/moderation auditing.
  RETURN TRUE;
END;
$$;


-- ── 1g. send_message ────────────────────────────────────────
CREATE FUNCTION public.anonymous_send_message(
  p_room_id UUID,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      UUID;
  v_room     RECORD;
  v_content  TEXT;
  v_msg_id   UUID;
  v_now      TIMESTAMPTZ;
  v_my_alias TEXT;
  v_my_role  TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.anonymous_check_rate_limit(
       v_uid, 'message', 10, INTERVAL '10 seconds') THEN
    RAISE EXCEPTION 'Sending too fast. Slow down.';
  END IF;

  v_content := pg_catalog.btrim(p_content);
  IF pg_catalog.char_length(v_content) = 0
  OR pg_catalog.char_length(v_content) > 1000 THEN
    RAISE EXCEPTION 'Message must be 1–1000 characters.';
  END IF;

  SELECT * INTO v_room
  FROM public.anonymous_rooms
  WHERE id = p_room_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or already ended.';
  END IF;
  IF v_room.user_1 <> v_uid AND v_room.user_2 <> v_uid THEN
    RAISE EXCEPTION 'You are not a participant in this room.';
  END IF;

  v_my_alias := CASE WHEN v_room.user_1 = v_uid
                  THEN v_room.user_1_alias
                  ELSE v_room.user_2_alias END;
  v_my_role := CASE WHEN v_room.user_1 = v_uid THEN 'user_1' ELSE 'user_2' END;
  v_now := pg_catalog.now();

  INSERT INTO public.anonymous_messages (room_id, sender_role, sender_alias, content, created_at)
  VALUES (p_room_id, v_my_role, v_my_alias, v_content, v_now)
  RETURNING id INTO v_msg_id;

  RETURN pg_catalog.jsonb_build_object(
    'id',           v_msg_id,
    'room_id',      p_room_id,
    'sender_role',  v_my_role,
    'sender_alias', v_my_alias,
    'is_self',      true,
    'content',      v_content,
    'created_at',   v_now
  );
END;
$$;


-- ── 1h. block_partner ───────────────────────────────────────
CREATE FUNCTION public.anonymous_block_partner(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        UUID;
  v_room       RECORD;
  v_partner_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous blocking requires READ COMMITTED isolation.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);

  SELECT * INTO v_room FROM public.anonymous_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found.'; END IF;

  IF    v_room.user_1 = v_uid THEN v_partner_id := v_room.user_2;
  ELSIF v_room.user_2 = v_uid THEN v_partner_id := v_room.user_1;
  ELSE  RAISE EXCEPTION 'You are not a participant in this room.';
  END IF;

  -- End the target room
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
  WHERE id = p_room_id AND status = 'active';

  -- Record mutual block
  INSERT INTO public.anonymous_blocks (blocker_id, blocked_id)
  VALUES (v_uid, v_partner_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Terminate any other active room between this blocked pair
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
  WHERE status = 'active'
    AND ((user_1 = v_uid AND user_2 = v_partner_id) OR (user_1 = v_partner_id AND user_2 = v_uid));

  -- Remove caller from waiting queue; do not delete partner's queue entry if searching for another match
  DELETE FROM public.anonymous_queue WHERE user_id = v_uid;

  RETURN TRUE;
END;
$$;


-- ── 1i. report_partner ──────────────────────────────────────
CREATE FUNCTION public.anonymous_report_partner(
  p_room_id UUID,
  p_reason  TEXT,
  p_snippet TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        UUID;
  v_room       RECORD;
  v_partner_id UUID;
  v_reason     TEXT;
  v_snippet    TEXT;
  v_report_id  UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous reporting requires READ COMMITTED isolation.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);

  IF NOT public.anonymous_check_rate_limit(
       v_uid, 'report', 3, INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Too many reports submitted recently.';
  END IF;

  v_reason := pg_catalog.btrim(p_reason);
  IF pg_catalog.char_length(v_reason) < 3
  OR pg_catalog.char_length(v_reason) > 300 THEN
    RAISE EXCEPTION 'Report reason must be 3–300 characters.';
  END IF;

  v_snippet := NULLIF(pg_catalog.btrim(COALESCE(p_snippet, '')), '');
  IF v_snippet IS NOT NULL
  AND pg_catalog.char_length(v_snippet) > 500 THEN
    v_snippet := pg_catalog.substr(v_snippet, 1, 500);
  END IF;

  SELECT * INTO v_room FROM public.anonymous_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found.'; END IF;

  IF    v_room.user_1 = v_uid THEN v_partner_id := v_room.user_2;
  ELSIF v_room.user_2 = v_uid THEN v_partner_id := v_room.user_1;
  ELSE  RAISE EXCEPTION 'You are not a participant in this room.';
  END IF;

  -- End the reported room
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
  WHERE id = p_room_id AND status = 'active';

  -- Record report for admin review
  INSERT INTO public.anonymous_reports
    (reporter_id, reported_id, room_id, reason, snippet, status)
  VALUES (v_uid, v_partner_id, p_room_id, v_reason, v_snippet, 'pending')
  RETURNING id INTO v_report_id;

  -- Enforce automatic mutual block
  INSERT INTO public.anonymous_blocks (blocker_id, blocked_id)
  VALUES (v_uid, v_partner_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Terminate any other active room between this pair
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
  WHERE status = 'active'
    AND ((user_1 = v_uid AND user_2 = v_partner_id) OR (user_1 = v_partner_id AND user_2 = v_uid));

  -- Remove caller from waiting queue; do not delete partner's queue entry if searching for another match
  DELETE FROM public.anonymous_queue WHERE user_id = v_uid;

  RETURN v_report_id;
END;
$$;


-- ── 1j. admin_review_report ─────────────────────────────────
CREATE FUNCTION public.anonymous_admin_review_report(
  p_report_id UUID,
  p_status    TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  IF public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator privileges required.';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('reviewed', 'dismissed') THEN
    RAISE EXCEPTION 'Status must be ''reviewed'' or ''dismissed''.';
  END IF;

  UPDATE public.anonymous_reports
  SET status = p_status
  WHERE id = p_report_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found or already resolved.';
  END IF;

  RETURN TRUE;
END;
$$;


-- ── 11k. admin_get_report_transcript ─────────────────────────
CREATE FUNCTION public.anonymous_admin_get_report_transcript(p_report_id UUID)
RETURNS TABLE (
  message_id     UUID,
  sender_role    TEXT,
  sender_alias   TEXT,
  content        TEXT,
  created_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID;
  v_report RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator access required.';
  END IF;

  SELECT * INTO v_report
  FROM public.anonymous_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found.';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.sender_role,
    m.sender_alias,
    m.content,
    m.created_at
  FROM public.anonymous_messages m
  WHERE m.room_id = v_report.room_id
  ORDER BY m.created_at ASC;
END;
$$;


-- ─── 2. EXECUTION GRANTS (CORE RPCS) ────────────────────────
REVOKE ALL ON FUNCTION public.anonymous_join_or_match() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_join_or_match() TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_check_match() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_check_match() TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_get_room_info(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_get_room_info(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_get_messages(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_get_messages(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_heartbeat() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_heartbeat() TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_leave(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_leave(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_send_message(UUID,TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_send_message(UUID,TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_block_partner(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_block_partner(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_report_partner(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_report_partner(UUID,TEXT,TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_admin_review_report(UUID,TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_admin_review_report(UUID,TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_admin_get_report_transcript(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_admin_get_report_transcript(UUID) TO authenticated;


-- ─── 3. SUPABASE REALTIME CONFIGURATION ──────────────────────
-- Add anonymous_messages (zero UUID columns) to supabase_realtime.
-- Re-verify that sensitive tables and public schema are not published.
-- Fails explicitly if the Realtime publication is missing or invalid.
DO $$
BEGIN
  -- 1. Fail explicitly if publication is missing, publishes all tables, or lacks INSERT events
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Realtime publication supabase_realtime does not exist. Stop and inspect Supabase Realtime setup.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime' AND puballtables
  ) THEN
    RAISE EXCEPTION 'Realtime publication supabase_realtime has puballtables = true. Sensitive Anonymous tables would be exposed. Set puballtables = false before proceeding.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime' AND pubinsert
  ) THEN
    RAISE EXCEPTION 'Realtime publication supabase_realtime does not have INSERT events enabled (pubinsert = false). Messages cannot stream.';
  END IF;

  -- 2. Fail explicitly if publication publishes entire public schema (PostgreSQL 15+)
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'pg_catalog' AND c.relname = 'pg_publication_namespace'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_publication_namespace pn
      JOIN pg_catalog.pg_publication p ON p.oid = pn.pnpubid
      JOIN pg_catalog.pg_namespace n ON n.oid = pn.pnnspid
      WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public'
    ) THEN
      RAISE EXCEPTION 'Realtime publication supabase_realtime publishes the entire public schema (pg_publication_namespace). Sensitive Anonymous tables would be exposed. Remove schema-wide publication before proceeding.';
    END IF;
  END IF;

  -- 3. Fail explicitly if any sensitive Anonymous table is published
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'anonymous_queue',
        'anonymous_rooms',
        'anonymous_blocks',
        'anonymous_reports',
        'anonymous_rate_limits',
        'anonymous_video_sessions',
        'anonymous_signals',
        'anonymous_active_participants'
      ])
  ) THEN
    RAISE EXCEPTION 'Realtime must not publish sensitive Anonymous tables; inspect the publication.';
  END IF;

  -- 4. Safely add anonymous_messages if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'anonymous_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.anonymous_messages;
  END IF;

  -- 5. Post-addition verification: verify anonymous_messages is now published
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'anonymous_messages'
  ) THEN
    RAISE EXCEPTION 'Failed to add public.anonymous_messages to supabase_realtime publication.';
  END IF;
END;
$$;

COMMIT;
