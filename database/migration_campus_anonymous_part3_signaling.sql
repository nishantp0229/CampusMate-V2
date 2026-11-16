-- =============================================================
-- CAMPUSMATE — CAMPUSANONYMOUS PRODUCTION MIGRATION
-- PART 3 OF 3: WEBRTC VIDEO & AUDIO SIGNALING ENGINE
-- =============================================================
-- Audience: Production Supabase project (run AFTER Part 2)
-- Safe for execution via Supabase Dashboard SQL Editor (~13 KB).
-- Wrapped in an explicit transaction block: rolls back on any error.
--
-- Contents:
--   - Preflight dependency verification: confirms Part 1 & Part 2 exist
--   - 2 WebRTC Signaling SECURITY DEFINER RPC functions:
--       1l. anonymous_send_signal()
--       1m. anonymous_poll_signals()
--   - Explicit execution grants for signaling RPCs
-- =============================================================

BEGIN;

-- ─── 0. PREFLIGHT DEPENDENCY CHECK (PART 1 & 2 REQUIRED) ───────
DO $$
BEGIN
  -- 1. Verify video session and signal tables exist from Part 1
  IF pg_catalog.to_regclass('public.anonymous_video_sessions') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_signals') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_rooms') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_rate_limits') IS NULL THEN
    RAISE EXCEPTION 'Part 3 requires tables from Part 1. Run Part 1 first.';
  END IF;

  -- 2. Verify rate limit helper exists from Part 1
  IF pg_catalog.to_regprocedure('public.anonymous_check_rate_limit(uuid,text,integer,interval)') IS NULL THEN
    RAISE EXCEPTION 'Part 3 requires rate-limit helper from Part 1. Run Part 1 first.';
  END IF;

  -- 3. Verify Part 2 core RPCs exist
  IF pg_catalog.to_regprocedure('public.anonymous_join_or_match()') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_send_message(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Part 3 requires core RPCs from Part 2. Run Part 2 first.';
  END IF;

  -- 4. Verify Realtime publication state is valid and anonymous_messages is published
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime' AND NOT puballtables AND pubinsert
  ) THEN
    RAISE EXCEPTION 'Part 3 requires valid supabase_realtime publication with puballtables = false and pubinsert = true. Run Part 2 first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'anonymous_messages'
  ) THEN
    RAISE EXCEPTION 'Part 3 requires public.anonymous_messages to be published in supabase_realtime. Run Part 2 first.';
  END IF;

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
    RAISE EXCEPTION 'Realtime must not publish sensitive Anonymous tables (including anonymous_signals); inspect publication.';
  END IF;
END;
$$;


-- ─── 1. WEBRTC SIGNALING RPC FUNCTIONS ────────────────────────
-- ── 11l. send_signal ─────────────────────────────────────────
CREATE FUNCTION public.anonymous_send_signal(
  p_room_id UUID,
  p_session_id UUID,
  p_event TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_room RECORD;
  v_session RECORD;
  v_role TEXT;
  v_session_id UUID;
  v_next_status TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_event IS NULL OR p_event NOT IN (
    'video_request', 'video_accept', 'video_reject', 'video_offer',
    'video_answer', 'video_ice', 'video_end'
  ) THEN RAISE EXCEPTION 'Invalid signaling event.'; END IF;
  IF p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid signaling payload.';
  END IF;

  IF p_event IN ('video_offer', 'video_answer') THEN
    IF pg_catalog.octet_length(p_payload::text) > 32768
       OR pg_catalog.jsonb_typeof(p_payload->'sdp') IS DISTINCT FROM 'string'
       OR pg_catalog.octet_length(p_payload->>'sdp') < 1
       OR (p_event = 'video_offer' AND p_payload->>'type' IS DISTINCT FROM 'offer')
       OR (p_event = 'video_answer' AND p_payload->>'type' IS DISTINCT FROM 'answer')
       OR (p_payload - 'sdp' - 'type') <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Invalid SDP payload.';
    END IF;
  ELSIF p_event = 'video_ice' THEN
    IF pg_catalog.octet_length(p_payload::text) > 4096
       OR pg_catalog.jsonb_typeof(p_payload->'candidate') IS DISTINCT FROM 'string'
       OR pg_catalog.octet_length(p_payload->>'candidate') < 1
       OR (p_payload - 'candidate' - 'sdpMid' - 'sdpMLineIndex' - 'usernameFragment') <> '{}'::jsonb
       OR (p_payload ? 'sdpMid' AND pg_catalog.jsonb_typeof(p_payload->'sdpMid') NOT IN ('string', 'null'))
       OR (p_payload ? 'sdpMLineIndex' AND pg_catalog.jsonb_typeof(p_payload->'sdpMLineIndex') NOT IN ('number', 'null'))
       OR (p_payload ? 'usernameFragment' AND pg_catalog.jsonb_typeof(p_payload->'usernameFragment') NOT IN ('string', 'null')) THEN
      RAISE EXCEPTION 'Invalid ICE payload.';
    END IF;
  ELSIF p_payload <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Unexpected signaling payload.';
  END IF;

  IF NOT public.anonymous_check_rate_limit(v_uid, 'signal_send', 120, INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Too many signaling operations.';
  END IF;
  SELECT * INTO v_room FROM public.anonymous_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR v_room.status <> 'active' THEN
    RAISE EXCEPTION 'Room not found or already ended.';
  END IF;
  IF v_room.user_1 = v_uid THEN v_role := 'user_1';
  ELSIF v_room.user_2 = v_uid THEN v_role := 'user_2';
  ELSE RAISE EXCEPTION 'You are not a participant in this room.';
  END IF;

  SELECT * INTO v_session FROM public.anonymous_video_sessions WHERE room_id = p_room_id;
  IF p_event = 'video_request' THEN
    IF p_session_id IS NOT NULL THEN RAISE EXCEPTION 'A new call cannot reuse a session.'; END IF;
    IF FOUND AND v_session.status <> 'ended'
       AND (v_session.status = 'connected'
            OR v_session.updated_at > pg_catalog.now() - INTERVAL '2 minutes') THEN
      RAISE EXCEPTION 'A video call is already in progress.';
    END IF;
    v_session_id := pg_catalog.gen_random_uuid();
    INSERT INTO public.anonymous_video_sessions (room_id, session_id, requester_role, status, updated_at)
    VALUES (p_room_id, v_session_id, v_role, 'requested', pg_catalog.now())
    ON CONFLICT (room_id) DO UPDATE
    SET session_id = EXCLUDED.session_id, requester_role = EXCLUDED.requester_role,
        status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;
  ELSE
    IF NOT FOUND OR p_session_id IS NULL OR v_session.session_id <> p_session_id
       OR v_session.status = 'ended' THEN
      RAISE EXCEPTION 'Video session is no longer active.';
    END IF;
    IF v_session.status IN ('requested', 'accepted', 'offered')
       AND v_session.updated_at <= pg_catalog.now() - INTERVAL '2 minutes'
       AND p_event <> 'video_end' THEN
      RAISE EXCEPTION 'Video handshake has expired.';
    END IF;
    v_session_id := v_session.session_id;
    v_next_status := v_session.status;
    IF p_event = 'video_accept' AND v_role <> v_session.requester_role AND v_session.status = 'requested' THEN
      v_next_status := 'accepted';
    ELSIF p_event = 'video_reject' AND v_role <> v_session.requester_role AND v_session.status = 'requested' THEN
      v_next_status := 'ended';
    ELSIF p_event = 'video_offer' AND v_role = v_session.requester_role AND v_session.status = 'accepted' THEN
      v_next_status := 'offered';
    ELSIF p_event = 'video_answer' AND v_role <> v_session.requester_role AND v_session.status = 'offered' THEN
      v_next_status := 'connected';
    ELSIF p_event = 'video_ice' AND v_session.status IN ('accepted', 'offered', 'connected') THEN
      NULL;
    ELSIF p_event = 'video_end' THEN
      v_next_status := 'ended';
    ELSE
      RAISE EXCEPTION 'Invalid signaling state transition.';
    END IF;
    UPDATE public.anonymous_video_sessions
    SET status = v_next_status, updated_at = pg_catalog.now()
    WHERE room_id = p_room_id;
  END IF;
  INSERT INTO public.anonymous_signals (room_id, session_id, sender_role, event, payload)
  VALUES (p_room_id, v_session_id, v_role, p_event, p_payload);
  RETURN pg_catalog.jsonb_build_object('session_id', v_session_id);
END;
$$;


-- ── 11m. poll_signals ────────────────────────────────────────
CREATE FUNCTION public.anonymous_poll_signals(p_room_id UUID, p_after_id BIGINT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_room RECORD;
  v_session RECORD;
  v_role TEXT;
  v_events JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF p_after_id IS NULL OR p_after_id < 0 THEN RAISE EXCEPTION 'Invalid signaling cursor.'; END IF;
  IF NOT public.anonymous_check_rate_limit(v_uid, 'signal_poll', 90, INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Too many signaling polls.';
  END IF;
  SELECT * INTO v_room FROM public.anonymous_rooms WHERE id = p_room_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found.'; END IF;
  IF v_room.user_1 = v_uid THEN v_role := 'user_1';
  ELSIF v_room.user_2 = v_uid THEN v_role := 'user_2';
  ELSE RAISE EXCEPTION 'You are not a participant in this room.';
  END IF;
  IF v_room.status <> 'active' THEN
    RETURN pg_catalog.jsonb_build_object('room_active', false, 'events', '[]'::jsonb);
  END IF;
  SELECT * INTO v_session FROM public.anonymous_video_sessions WHERE room_id = p_room_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('room_active', true, 'events', '[]'::jsonb);
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', s.id, 'session_id', s.session_id, 'event', s.event, 'payload', s.payload
  ) ORDER BY s.id), '[]'::jsonb) INTO v_events
  FROM (
    SELECT * FROM public.anonymous_signals
    WHERE room_id = p_room_id AND session_id = v_session.session_id
      AND sender_role <> v_role AND id > p_after_id
      AND created_at > pg_catalog.now() - INTERVAL '2 minutes'
      AND (v_session.status <> 'ended' OR event IN ('video_end', 'video_reject'))
    ORDER BY id LIMIT 200
  ) s;
  RETURN pg_catalog.jsonb_build_object(
    'room_active', true, 'session_id', v_session.session_id,
    'session_status', v_session.status, 'events', v_events
  );
END;
$$;


-- ─── 2. EXECUTION GRANTS (SIGNALING RPCS) ────────────────────
REVOKE ALL ON FUNCTION public.anonymous_send_signal(UUID,UUID,TEXT,JSONB) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_send_signal(UUID,UUID,TEXT,JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_poll_signals(UUID,BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_poll_signals(UUID,BIGINT) TO authenticated;

COMMIT;
