-- =============================================================
-- CampusMate — CampusAnonymous Production Migration (Part 1 of 2: Schema & RLS)
-- File: database/migration_campus_anonymous_part1_schema.sql
--
-- EXECUTION ORDER:
--   Step 1: Execute this file (Part 1) first.
--   Step 2: Verify with Part 1 verification query.
--   Step 3: Execute migration_campus_anonymous_part2_rpcs.sql (Part 2).
--
-- Scope of Part 1:
--   - Preflight dependency checks (profiles, admin_users, is_admin)
--   - 9 Core Tables (queue, blocks, rooms, active_participants, messages,
--     reports, rate_limits, video_sessions, signals)
--   - Cross-column single-room invariant table and trigger
--   - Row Level Security (RLS) enabled on all 9 tables
--   - Safe SELECT grants and RLS policies
--   - Room membership and rate-limiting helper functions
-- =============================================================

BEGIN;

-- ─── 0. PREFLIGHT DEPENDENCY & COLLISION CHECK ───────────────
DO $$
DECLARE
  v_name TEXT;
BEGIN
  -- 1. Base dependency: public.profiles table from schema.sql
  IF pg_catalog.to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'CampusAnonymous requires public.profiles from database/schema.sql.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'id'
      AND atttypid = 'uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'CampusAnonymous requires public.profiles.id UUID.';
  END IF;

  -- 2. Phase A admin dependency: public.admin_users table and public.is_admin()
  IF pg_catalog.to_regclass('public.admin_users') IS NULL THEN
    RAISE EXCEPTION 'CampusAnonymous requires Phase A admin table (public.admin_users).';
  END IF;
  IF pg_catalog.to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'CampusAnonymous requires Phase A function public.is_admin().';
  END IF;

  -- 3. Supabase Realtime publication check
  -- 3a. Must exist, must not publish all tables, and must have INSERT events enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime' AND NOT puballtables AND pubinsert
  ) THEN
    RAISE EXCEPTION 'Realtime publication supabase_realtime must exist, must not publish all tables (puballtables = false), and must have INSERT events enabled (pubinsert = true).';
  END IF;

  -- 3b. Must not publish the entire public schema (PostgreSQL 15+ pg_publication_namespace)
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
      RAISE EXCEPTION 'Realtime publication supabase_realtime must not publish the entire public schema (pg_publication_namespace). Sensitive Anonymous tables would be exposed.';
    END IF;
  END IF;

  -- 3c. Ensure sensitive tables are NOT published in Realtime
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

  -- 4. Detect conflicting tables
  FOREACH v_name IN ARRAY ARRAY[
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
    IF pg_catalog.to_regclass(format('public.%I', v_name)) IS NOT NULL THEN
      RAISE EXCEPTION 'Table public.% already exists. Stop and inspect existing installation.', v_name;
    END IF;
  END LOOP;

  -- 5. Detect conflicting functions
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
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
        'anonymous_admin_get_report_transcript',
        'anonymous_sync_active_participants'
      ])
  ) THEN
    RAISE EXCEPTION 'A CampusAnonymous function already exists. Inspect before proceeding.';
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


-- ─── 2. MUTUAL BLOCKS ────────────────────────────────────────
CREATE TABLE public.anonymous_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT anonymous_no_self_block CHECK (blocker_id <> blocked_id),
  CONSTRAINT anonymous_unique_block  UNIQUE (blocker_id, blocked_id)
);
-- Reverse index accelerates mutual-block lookup (b.blocker_id = q.user_id AND b.blocked_id = v_uid)
-- without duplicating the forward index created automatically by anonymous_unique_block:
CREATE INDEX anonymous_blocks_blocked_idx ON public.anonymous_blocks (blocked_id, blocker_id);


-- ─── 3. ANONYMOUS ROOMS ──────────────────────────────────────
-- Canonical ordering: user_1 < user_2 (UUID order).
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
  CONSTRAINT anonymous_room_different_users CHECK (user_1 <> user_2),
  CONSTRAINT anonymous_room_canonical_users CHECK (user_1 < user_2)
);
CREATE INDEX anonymous_rooms_user_1_idx ON public.anonymous_rooms (user_1, status);
CREATE INDEX anonymous_rooms_user_2_idx ON public.anonymous_rooms (user_2, status);
CREATE UNIQUE INDEX anonymous_rooms_one_active_per_user_1
  ON public.anonymous_rooms (user_1) WHERE (status = 'active');
CREATE UNIQUE INDEX anonymous_rooms_one_active_per_user_2
  ON public.anonymous_rooms (user_2) WHERE (status = 'active');


-- ─── 4. ACTIVE PARTICIPANTS (CROSS-COLUMN SINGLE-ROOM INVARIANT)
CREATE TABLE public.anonymous_active_participants (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.anonymous_rooms(id) ON DELETE CASCADE
);
CREATE INDEX anonymous_active_participants_room_idx
  ON public.anonymous_active_participants (room_id);

CREATE FUNCTION public.anonymous_sync_active_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_RELID <> 'public.anonymous_rooms'::regclass THEN
    RAISE EXCEPTION 'Invalid active-participant trigger relation.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_1 IS DISTINCT FROM OLD.user_1
       OR NEW.user_2 IS DISTINCT FROM OLD.user_2 THEN
      RAISE EXCEPTION 'Anonymous room identity and participants cannot be changed.';
    END IF;
    IF OLD.status = 'ended' AND NEW.status = 'active' THEN
      RAISE EXCEPTION 'An ended anonymous room cannot be reopened.';
    END IF;
    IF OLD.status = 'active' AND NEW.status = 'ended' THEN
      DELETE FROM public.anonymous_active_participants WHERE room_id = NEW.id;
    END IF;
  ELSIF NEW.status = 'active' THEN
    -- Both participants inserted in sorted UUID order.
    -- If either student already has an active room, PK violation aborts room creation.
    INSERT INTO public.anonymous_active_participants (user_id, room_id)
    SELECT participant.user_id, NEW.id
    FROM (VALUES (NEW.user_1), (NEW.user_2)) AS participant(user_id)
    ORDER BY participant.user_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_sync_active_participants() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER anonymous_sync_active_participants
AFTER INSERT OR UPDATE ON public.anonymous_rooms
FOR EACH ROW EXECUTE FUNCTION public.anonymous_sync_active_participants();


-- ─── 5. EPHEMERAL MESSAGES (ZERO STUDENT UUID COLUMNS) ───────
-- Sender identity is strictly recorded by role ('user_1' or 'user_2') and alias.
-- Supabase Realtime postgres_changes can safely stream inserts without leaking user UUIDs.
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


-- ─── 6. ABUSE REPORTS (RETAINED FOR ADMIN REVIEW) ────────────
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


-- ─── 7. RATE LIMITS ──────────────────────────────────────────
CREATE TABLE public.anonymous_rate_limits (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  count        INT  NOT NULL DEFAULT 1,
  PRIMARY KEY  (user_id, action)
);


-- ─── 8. WEBRTC VIDEO SESSIONS & SIGNALS ──────────────────────
CREATE TABLE public.anonymous_video_sessions (
  room_id        UUID PRIMARY KEY REFERENCES public.anonymous_rooms(id) ON DELETE CASCADE,
  session_id     UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  requester_role TEXT NOT NULL CHECK (requester_role IN ('user_1', 'user_2')),
  status         TEXT NOT NULL CHECK (status IN ('requested', 'accepted', 'offered', 'connected', 'ended')),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.anonymous_signals (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id     UUID NOT NULL REFERENCES public.anonymous_rooms(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user_1', 'user_2')),
  event       TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX anonymous_signals_room_id_idx ON public.anonymous_signals (room_id, id);


-- ─── 9. RLS & ACCESS CONTROL CONFIGURATION ───────────────────
ALTER TABLE public.anonymous_queue               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_blocks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_active_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_rate_limits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_video_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_signals             ENABLE ROW LEVEL SECURITY;

-- Revoke all direct client writes and reads across all tables
REVOKE ALL ON
  public.anonymous_queue,
  public.anonymous_blocks,
  public.anonymous_rooms,
  public.anonymous_active_participants,
  public.anonymous_messages,
  public.anonymous_reports,
  public.anonymous_rate_limits,
  public.anonymous_video_sessions,
  public.anonymous_signals
FROM PUBLIC, anon, authenticated;

-- Direct SELECT is granted only on non-sensitive tables/columns:
GRANT SELECT ON
  public.anonymous_queue,
  public.anonymous_messages,
  public.anonymous_rate_limits
TO authenticated;

GRANT SELECT (id, reason, snippet, status, created_at)
  ON public.anonymous_reports TO authenticated;

-- Definer helper to check caller's room membership without exposing room records
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
REVOKE ALL ON FUNCTION public.anonymous_is_room_participant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymous_is_room_participant(UUID) TO authenticated;

-- RLS Policies
CREATE POLICY anonymous_queue_user_select
  ON public.anonymous_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY anonymous_rate_limits_user_select
  ON public.anonymous_rate_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY anonymous_messages_participant_select
  ON public.anonymous_messages FOR SELECT TO authenticated
  USING (public.anonymous_is_room_participant(room_id));

CREATE POLICY anonymous_reports_admin_select
  ON public.anonymous_reports FOR SELECT TO authenticated
  USING (public.is_admin() IS TRUE);


-- ─── 10. RATE LIMITING HELPER ────────────────────────────────
CREATE FUNCTION public.anonymous_check_rate_limit(
  p_user_id UUID,
  p_action  TEXT,
  p_max     INT,
  p_window  INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.anonymous_rate_limits (user_id, action, window_start, count)
  VALUES (p_user_id, p_action, pg_catalog.now(), 1)
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
REVOKE ALL ON FUNCTION public.anonymous_check_rate_limit(UUID, TEXT, INT, INTERVAL) FROM PUBLIC, anon, authenticated;

COMMIT;
