-- =============================================================
-- SUPERSEDED — DO NOT EXECUTE
-- This migration has been superseded by:
--   database/migration_campus_anonymous_canonical.sql
-- Retained for historical audit reference only.
-- =============================================================
-- CampusMate — Phase E: CampusAnonymous Migration
-- Alias-based 1-on-1 anonymous student chat & matchmaking.
--
-- Security model:
--   - Direct client writes (INSERT/UPDATE/DELETE) revoked on all tables.
--   - SELECT restricted to own rows via RLS; partner UUIDs are never
--     returned from any SELECT policy, view, or RPC.
--   - All mutations routed through SECURITY DEFINER RPCs with
--     SET search_path = '' and identity derived from auth.uid().
--   - Partner UUID is structurally absent from every RPC return value
--     and from every Realtime payload.
--   - Concurrency-safe matchmaking: per-user advisory lock +
--     FOR UPDATE SKIP LOCKED + partial unique indexes.
--   - Messages are retained: no leave, block, report, or review RPC deletes
--     evidence. A separately approved retention design is still required.
--   - Fixed-window server-side rate limits.
--   - WebRTC signaling uses validated RPCs, not client broadcasts or cached
--     private-channel authorization. Messages use Postgres Changes with RLS.
--   - Phase A admin infrastructure (public.is_admin(), public.admin_users)
--     verified in preflight and used directly.
--   - Stale cleanup performed opportunistically in join_or_match();
--     no guaranteed scheduled cleanup without pg_cron.
--   - PostgreSQL btrim used throughout; no bare trim() calls.
-- =============================================================

BEGIN;

-- ─── 0. PREFLIGHT ────────────────────────────────────────────
DO $$
DECLARE
  v_name TEXT;
BEGIN
  -- 1. Base dependency: profiles table
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Phase E requires public.profiles from schema.sql.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'id'
      AND atttypid = 'uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Phase E requires public.profiles.id UUID.';
  END IF;

  -- 2. Phase A admin dependency: both admin_users table and is_admin() must exist.
  --    The report RLS policy calls public.is_admin() directly.
  IF to_regclass('public.admin_users') IS NULL THEN
    RAISE EXCEPTION
      'Phase E requires Phase A admin table (public.admin_users). Run Phase A migration first.';
  END IF;
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION
      'Phase E requires Phase A function public.is_admin(). Run Phase A migration first.';
  END IF;

  -- Postgres Changes is required for message delivery. Never publish every
  -- table: rooms and report records contain participant identities.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
    RAISE EXCEPTION 'An existing table-specific supabase_realtime publication is required.';
  END IF;

  -- 4. Detect conflicting tables
  FOREACH v_name IN ARRAY ARRAY[
    'anonymous_queue',
    'anonymous_rooms',
    'anonymous_messages',
    'anonymous_blocks',
    'anonymous_reports',
    'anonymous_rate_limits',
    'anonymous_video_sessions',
    'anonymous_signals'
  ] LOOP
    IF to_regclass(format('public.%I', v_name)) IS NOT NULL THEN
      RAISE EXCEPTION
        'Table public.% already exists. Stop and inspect the existing installation.', v_name;
    END IF;
  END LOOP;

  -- 5. Detect conflicting functions
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'anonymous_join_or_match', 'anonymous_check_match',
        'anonymous_heartbeat',     'anonymous_leave',
        'anonymous_send_message',  'anonymous_block_partner',
        'anonymous_report_partner','anonymous_admin_review_report',
        'anonymous_check_rate_limit',
        'anonymous_get_room_info', 'anonymous_get_messages',
        'anonymous_is_room_participant',
        'anonymous_send_signal', 'anonymous_poll_signals',
        'anonymous_admin_get_report_transcript'
      ])
  ) THEN
    RAISE EXCEPTION
      'A CampusAnonymous function already exists. Inspect before proceeding.';
  END IF;
END;
$$;


-- ─── 1. WAITING QUEUE ────────────────────────────────────────
CREATE TABLE public.anonymous_queue (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  heartbeat  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX anonymous_queue_heartbeat_idx ON public.anonymous_queue (heartbeat);


-- ─── 2. BLOCKS ───────────────────────────────────────────────
CREATE TABLE public.anonymous_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT anonymous_no_self_block   CHECK (blocker_id <> blocked_id),
  CONSTRAINT anonymous_unique_block    UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX anonymous_blocks_blocker_idx ON public.anonymous_blocks (blocker_id, blocked_id);


-- ─── 3. ROOMS ────────────────────────────────────────────────
-- Canonical ordering: user_1 < user_2 (UUID comparison).
-- user_1 and user_2 are intentionally NOT returned to clients;
-- participant UUIDs are only used server-side inside RPCs.
CREATE TABLE public.anonymous_rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_2        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_1_alias  TEXT NOT NULL
    CHECK (pg_catalog.char_length(pg_catalog.btrim(user_1_alias)) >= 2
       AND pg_catalog.char_length(user_1_alias) <= 50),
  user_2_alias  TEXT NOT NULL
    CHECK (pg_catalog.char_length(pg_catalog.btrim(user_2_alias)) >= 2
       AND pg_catalog.char_length(user_2_alias) <= 50),
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  ended_at      TIMESTAMPTZ,
  ended_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT anonymous_room_different_users  CHECK (user_1 <> user_2),
  CONSTRAINT anonymous_room_canonical_users  CHECK (user_1 < user_2)
);
CREATE INDEX anonymous_rooms_user_1_idx ON public.anonymous_rooms (user_1, status);
CREATE INDEX anonymous_rooms_user_2_idx ON public.anonymous_rooms (user_2, status);

-- DB-level guarantee: each user may be in at most one ACTIVE room.
-- These partial unique indexes prevent concurrent double-matching even
-- when application-level guards are bypassed.
CREATE UNIQUE INDEX anonymous_rooms_one_active_per_user_1
  ON public.anonymous_rooms (user_1) WHERE (status = 'active');
CREATE UNIQUE INDEX anonymous_rooms_one_active_per_user_2
  ON public.anonymous_rooms (user_2) WHERE (status = 'active');


-- ─── 4. MESSAGES ─────────────────────────────────────────────
-- Sender identity is stored as sender_role ('user_1' or 'user_2') and sender_alias.
-- Student UUIDs (user_1 and user_2) are strictly retained in anonymous_rooms.
-- Because anonymous_messages contains ZERO user UUID columns, Supabase Realtime
-- postgres_changes can safely stream inserts to authorized room participants
-- without any risk of exposing a partner's UUID!
CREATE TABLE public.anonymous_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES public.anonymous_rooms(id) ON DELETE CASCADE,
  sender_role  TEXT NOT NULL CHECK (sender_role IN ('user_1', 'user_2')),
  sender_alias TEXT NOT NULL
    CHECK (pg_catalog.char_length(pg_catalog.btrim(sender_alias)) >= 2
       AND pg_catalog.char_length(sender_alias) <= 50),
  content      TEXT NOT NULL
    CHECK (pg_catalog.char_length(pg_catalog.btrim(content)) > 0
       AND pg_catalog.char_length(content) <= 1000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX anonymous_messages_room_idx ON public.anonymous_messages (room_id, created_at ASC);


-- ─── 5. REPORTS ──────────────────────────────────────────────
-- Retain messages even after a room ends or a report is resolved. This avoids
-- races with late/concurrent reports. No automatic retention cleanup is installed.
CREATE TABLE public.anonymous_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  room_id     UUID NOT NULL REFERENCES public.anonymous_rooms(id) ON DELETE RESTRICT,
  reason      TEXT NOT NULL
    CHECK (pg_catalog.char_length(pg_catalog.btrim(reason)) >= 3
       AND pg_catalog.char_length(reason) <= 300),
  snippet     TEXT
    CHECK (snippet IS NULL OR pg_catalog.char_length(snippet) <= 500),
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX anonymous_reports_status_idx ON public.anonymous_reports (status, created_at DESC);
CREATE INDEX anonymous_reports_room_idx   ON public.anonymous_reports (room_id) WHERE (room_id IS NOT NULL);


-- ─── 6. RATE LIMITS ──────────────────────────────────────────
-- Fixed-window counter. Each row tracks (user_id, action) → count
-- within window_start. The upsert resets window_start when the
-- configured interval expires.
CREATE TABLE public.anonymous_rate_limits (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  count        INT  NOT NULL DEFAULT 1,
  PRIMARY KEY  (user_id, action)
);

-- Only RPCs can access signaling. A single server-generated call ID per room
-- prevents events from an older call from being used in its replacement.
CREATE TABLE public.anonymous_video_sessions (
  room_id UUID PRIMARY KEY REFERENCES public.anonymous_rooms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  requester_role TEXT NOT NULL CHECK (requester_role IN ('user_1', 'user_2')),
  status TEXT NOT NULL CHECK (status IN ('requested', 'accepted', 'offered', 'connected', 'ended')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.anonymous_signals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.anonymous_rooms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user_1', 'user_2')),
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX anonymous_signals_room_id_idx ON public.anonymous_signals (room_id, id);


-- ─── 7. RLS & GRANT CONFIGURATION ────────────────────────────
ALTER TABLE public.anonymous_queue        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_rate_limits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_video_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_signals ENABLE ROW LEVEL SECURITY;

-- Revoke all direct access from every client role across ALL tables
REVOKE ALL ON
  public.anonymous_queue,
  public.anonymous_blocks,
  public.anonymous_rooms,
  public.anonymous_messages,
  public.anonymous_reports,
  public.anonymous_rate_limits,
  public.anonymous_video_sessions,
  public.anonymous_signals
FROM PUBLIC, anon, authenticated;

-- Direct SELECT on anonymous_rooms and anonymous_blocks is PERMANENTLY REVOKED
-- from all client roles to structurally guarantee zero participant UUID leakage.
-- All room operations occur exclusively via SECURITY DEFINER RPCs that return only
-- alias-safe JSONB payloads (anonymous_get_room_info, anonymous_check_match).
--
-- Direct client writes (INSERT/UPDATE/DELETE) are revoked on ALL tables.
--
-- Authenticated clients may SELECT on:
-- 1. anonymous_queue: own row only
-- 2. anonymous_rate_limits: own row only
-- 3. anonymous_messages: participants of that active room only (zero UUID columns exist on this table)
-- 4. anonymous_reports: administrators only (for AnonymousModeration panel)
GRANT SELECT ON
  public.anonymous_queue,
  public.anonymous_messages,
  public.anonymous_rate_limits
TO authenticated;
GRANT SELECT (id, reason, snippet, status, created_at)
  ON public.anonymous_reports TO authenticated;

-- RLS expressions run with the caller's privileges. This definer helper
-- checks only the caller's own membership without granting access to rooms.
CREATE FUNCTION public.anonymous_is_room_participant(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.anonymous_rooms r
    WHERE r.id = p_room_id
      AND (r.user_1 = auth.uid() OR r.user_2 = auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.anonymous_is_room_participant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymous_is_room_participant(UUID) TO authenticated;

-- Messages: participants of that room only (zero UUIDs exposed; required for postgres_changes)
CREATE POLICY anonymous_messages_participant_select
  ON public.anonymous_messages FOR SELECT TO authenticated
  USING (public.anonymous_is_room_participant(room_id));

-- Queue: own row only
CREATE POLICY anonymous_queue_own_select
  ON public.anonymous_queue FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Rate limits: own rows only
CREATE POLICY anonymous_rate_limits_own_select
  ON public.anonymous_rate_limits FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Reports: administrators only (Phase A is verified in preflight).
-- Normal participants cannot SELECT from anonymous_reports under any condition,
-- preventing students from discovering reported partner UUIDs.
CREATE POLICY anonymous_reports_admin_select
  ON public.anonymous_reports FOR SELECT TO authenticated
  USING (public.is_admin());


-- ─── 9. INTERNAL RATE LIMIT HELPER ───────────────────────────
-- Called only from SECURITY DEFINER RPCs. Not exposed to clients.
-- Returns TRUE when within limit, FALSE when exceeded.
-- p_max    — maximum allowed calls within p_window
-- p_window — fixed window interval
CREATE FUNCTION public.anonymous_check_rate_limit(
  p_uid    UUID,
  p_action TEXT,
  p_max    INT,
  p_window INTERVAL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.anonymous_rate_limits (user_id, action, window_start, count)
  VALUES (p_uid, p_action, pg_catalog.now(), 1)
  ON CONFLICT (user_id, action) DO UPDATE
    SET
      window_start = CASE
        WHEN public.anonymous_rate_limits.window_start
             < pg_catalog.now() - p_window
        THEN pg_catalog.now()
        ELSE public.anonymous_rate_limits.window_start
      END,
      count = CASE
        WHEN public.anonymous_rate_limits.window_start
             < pg_catalog.now() - p_window
        THEN 1
        ELSE public.anonymous_rate_limits.count + 1
      END
  RETURNING count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;

-- Not exposed to any client role
REVOKE EXECUTE ON FUNCTION
  public.anonymous_check_rate_limit(UUID, TEXT, INT, INTERVAL)
FROM PUBLIC, anon, authenticated;


-- ─── 9. RPCs ─────────────────────────────────────────────────

-- ── 9a. join_or_match ────────────────────────────────────────
-- Atomically joins the queue or matches with a waiting partner.
-- Returns JSONB with room_id and aliases only — no UUIDs.
--
-- Concurrency design:
--   · pg_advisory_xact_lock(hashtext(uid)) serializes calls from
--     the same user. Each user only takes their OWN lock — no
--     cross-user locking that would cause deadlocks.
--   · FOR UPDATE SKIP LOCKED prevents two transactions picking the
--     same waiting partner simultaneously.
--   · Partial unique indexes (status='active') at the storage level
--     prevent double-active-room insertion as a final backstop.
--
-- Rate limit: 5 per 60 seconds.
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

  -- Serialize concurrent calls from the same user.
  -- We lock only on the calling user's own hash — no cross-user lock,
  -- so two different users can run simultaneously without deadlock.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_uid::text));

  -- Rate limit: max 5 matchmaking attempts per 60 seconds
  IF NOT public.anonymous_check_rate_limit(
       v_uid, 'matchmaking', 5, INTERVAL '60 seconds') THEN
    RAISE EXCEPTION 'Too many matchmaking requests. Wait a moment and try again.';
  END IF;

  -- End any active room the caller is currently in
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
  WHERE (user_1 = v_uid OR user_2 = v_uid) AND status = 'active';

  -- Prune stale queue entries (no heartbeat for >60 s)
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
    -- Skip candidates already matched in an active room
    AND NOT EXISTS (
      SELECT 1 FROM public.anonymous_rooms r
      WHERE (r.user_1 = q.user_id OR r.user_2 = q.user_id)
        AND r.status = 'active'
    )
  ORDER BY q.joined_at ASC
  FOR UPDATE OF q SKIP LOCKED
  LIMIT 1;

  IF v_partner_id IS NOT NULL THEN
    -- Remove both from queue
    DELETE FROM public.anonymous_queue
    WHERE user_id IN (v_partner_id, v_uid);

    -- Pick two distinct aliases
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

    -- Return alias-only payload — partner UUID is NEVER included
    RETURN pg_catalog.jsonb_build_object(
      'matched',        true,
      'room_id',        v_room_id,
      'my_alias',       v_alias_caller,
      'partner_alias',  v_alias_partner
    );
  ELSE
    -- Enqueue caller
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


-- ── 9b. check_match ──────────────────────────────────────────
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


-- ── 9c. get_room_info ────────────────────────────────────────
-- Returns alias-safe room metadata for the calling participant.
-- Never returns user_1, user_2, or any participant UUID.
-- Called by the frontend on mount or reconnect.
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


-- ── 9d. get_messages ─────────────────────────────────────────
-- Returns message history for a room WITHOUT user UUIDs.
-- is_self is computed server-side from sender_role.
CREATE FUNCTION public.anonymous_get_messages(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   UUID;
  v_room  RECORD;
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

  -- Build JSON array; sender_role is used for is_self computation
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


-- ── 9e. heartbeat ────────────────────────────────────────────
-- Rate limit: 10 per 10 seconds (non-critical; silently ignores excess).
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


-- ── 9f. leave ────────────────────────────────────────────────
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

  DELETE FROM public.anonymous_queue WHERE user_id = v_uid;

  IF p_room_id IS NOT NULL THEN
    UPDATE public.anonymous_rooms
    SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
    WHERE id = p_room_id
      AND (user_1 = v_uid OR user_2 = v_uid)
      AND status = 'active';
  ELSE
    UPDATE public.anonymous_rooms
    SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
    WHERE (user_1 = v_uid OR user_2 = v_uid) AND status = 'active';
  END IF;

  -- Never delete evidence here: a report may be submitted concurrently or
  -- after the other participant leaves.
  RETURN TRUE;
END;
$$;


-- ── 9g. send_message ─────────────────────────────────────────
-- Validates message server-side, checks rate limits, writes to database,
-- and returns alias-safe JSONB for the caller.
-- Realtime postgres_changes delivers the verified INSERT event to the room
-- partner with ZERO participant UUID exposure.
-- Rate limit: 10 per 10 seconds.
CREATE FUNCTION public.anonymous_send_message(
  p_room_id UUID,
  p_content  TEXT
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

  -- Return alias-safe payload. Realtime postgres_changes delivers the verified INSERT
  -- to the partner directly from PostgreSQL with zero participant UUID exposure.
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


-- ── 9h. block_partner ────────────────────────────────────────
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

  SELECT * INTO v_room FROM public.anonymous_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found.'; END IF;

  IF    v_room.user_1 = v_uid THEN v_partner_id := v_room.user_2;
  ELSIF v_room.user_2 = v_uid THEN v_partner_id := v_room.user_1;
  ELSE  RAISE EXCEPTION 'You are not a participant in this room.';
  END IF;

  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
  WHERE id = p_room_id AND status = 'active';

  INSERT INTO public.anonymous_blocks (blocker_id, blocked_id)
  VALUES (v_uid, v_partner_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  DELETE FROM public.anonymous_queue WHERE user_id = v_uid;

  RETURN TRUE;
END;
$$;


-- ── 9i. report_partner ───────────────────────────────────────
-- Ends the room and inserts a report. Evidence is retained, including if a
-- participant already left or blocked the other participant.
-- Rate limit: 3 per hour.
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

  -- End the room
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = v_uid
  WHERE id = p_room_id AND status = 'active';

  -- Insert report (evidence is now recorded)
  INSERT INTO public.anonymous_reports
    (reporter_id, reported_id, room_id, reason, snippet, status)
  VALUES (v_uid, v_partner_id, p_room_id, v_reason, v_snippet, 'pending')
  RETURNING id INTO v_report_id;

  -- Messages are intentionally preserved, including after resolution.

  -- Block to prevent future matches
  INSERT INTO public.anonymous_blocks (blocker_id, blocked_id)
  VALUES (v_uid, v_partner_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  DELETE FROM public.anonymous_queue WHERE user_id = v_uid;

  RETURN v_report_id;
END;
$$;


-- ── 9j. admin_review_report ──────────────────────────────────
-- Requires Phase A admin. Resolution never deletes transcript evidence.
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
  v_uid      UUID;
  v_report   RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  -- Phase A is_admin() is guaranteed by preflight
  IF public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator privileges required.';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('reviewed', 'dismissed') THEN
    RAISE EXCEPTION 'Status must be ''reviewed'' or ''dismissed''.';
  END IF;

  SELECT * INTO v_report
  FROM public.anonymous_reports
  WHERE id = p_report_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found or already resolved.';
  END IF;

  UPDATE public.anonymous_reports
  SET status = p_status
  WHERE id = p_report_id;

  RETURN TRUE;
END;
$$;


-- ── 9k. admin_get_report_transcript ──────────────────────────
-- Administrators can retrieve verified message transcripts of reported rooms.
-- Only the specified report's room is accessible; student UUIDs are omitted.
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


-- Every signaling operation is authorized at the database, not by a
-- cached Realtime channel authorization.
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
       OR p_payload->>'type' IS DISTINCT FROM
          CASE WHEN p_event = 'video_offer' THEN 'offer' ELSE 'answer' END
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
    -- An abandoned handshake cannot be accepted or resumed later. A caller
    -- may still explicitly end it; an established call has no handshake TTL.
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

-- Only the other participant's recent events for the current call are
-- returned. Room membership and status are checked again on every poll.
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

-- ─── 10. EXECUTION GRANTS ────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.anonymous_join_or_match()         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_join_or_match()         TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_check_match()           FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_check_match()           TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_get_room_info(UUID)     FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_get_room_info(UUID)     TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_get_messages(UUID)      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_get_messages(UUID)      TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_heartbeat()             FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_heartbeat()             TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_leave(UUID)             FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_leave(UUID)             TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_send_message(UUID,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_send_message(UUID,TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_block_partner(UUID)     FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_block_partner(UUID)     TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_report_partner(UUID,TEXT,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_report_partner(UUID,TEXT,TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_admin_review_report(UUID,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_admin_review_report(UUID,TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_admin_get_report_transcript(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anonymous_admin_get_report_transcript(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.anonymous_send_signal(UUID,UUID,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymous_send_signal(UUID,UUID,TEXT,JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.anonymous_poll_signals(UUID,BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymous_poll_signals(UUID,BIGINT) TO authenticated;


-- ─── 11. REALTIME PUBLICATION CONFIGURATION ──────────────────
-- anonymous_rooms is EXCLUDED from supabase_realtime to prevent
-- participant UUIDs (user_1, user_2) from leaking in WAL payloads.
--
-- anonymous_messages is ADDED to supabase_realtime because it stores
-- ONLY alias-safe columns (room_id, sender_role, sender_alias, content, created_at)
-- and contains ZERO student UUID columns.
-- Supabase Realtime uses table RLS (anonymous_messages_participant_select)
-- to ensure ONLY room participants can receive
-- verified INSERT events for that room.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'anonymous_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.anonymous_messages;
    END IF;
  END IF;
END;
$$;

COMMIT;
