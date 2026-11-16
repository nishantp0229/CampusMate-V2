-- =============================================================
-- CampusMate — CampusAnonymous Canonical First-Install Migration
-- File: database/migration_campus_anonymous_canonical.sql
--
-- Single, canonical, production-ready first-install migration for CampusAnonymous.
-- Replaces the need to run multiple legacy or patch migrations.
--
-- Supersedes:
--   - database/migration_campus_anonymous.sql (superseded)
--   - database/migration_anonymous_active_participants.sql (superseded)
--   - database/migration_anonymous_chat.sql (superseded legacy prototype)
--   - database/migration_anonymous_message_retention.sql (superseded)
--   - database/migration_anonymous_signal_expiry.sql (superseded)
--
-- Key Architectural Guarantees:
-- 1. Cross-Column Single-Room Invariant:
--    - Table public.anonymous_active_participants (user_id PK, room_id)
--    - Trigger public.anonymous_sync_active_participants() on public.anonymous_rooms
--    - Enforces at the database engine level that no student can occupy multiple
--      active rooms across user_1 and user_2 simultaneously.
-- 2. Concurrency & Race-Condition Serialization:
--    - Strict advisory transaction lock (1129136973, 1) serializes all room mutations:
--      anonymous_join_or_match, anonymous_check_match, anonymous_leave,
--      anonymous_block_partner, anonymous_report_partner.
--    - Completely eliminates block/report-versus-rematch races, deadlocks, and duplicate matches.
--    - Enforces READ COMMITTED transaction isolation level.
-- 3. Strict Anonymity & Zero Identity Leakage:
--    - public.anonymous_messages contains ZERO student UUID columns (only room_id,
--      sender_role, sender_alias, content, created_at).
--    - Supabase Realtime postgres_changes streams INSERT events without WAL identity leakage.
--    - Direct client SELECT is permanently revoked on anonymous_rooms and anonymous_blocks.
--    - Partner UUID is structurally absent from every RPC return payload.
-- 4. Evidence Retention & Audit Integrity:
--    - Messages and reports are preserved for moderation review.
--    - Neither leaving nor blocking deletes chat evidence.
--    - No destructive cron jobs or automatic message deletion enabled.
-- 5. WebRTC Signaling via Validated Database RPCs:
--    - Client broadcasts bypassed; signaling routed through authorized RPCs.
--    - Strict SDP/ICE payload size and structure validation.
--    - Passive 2-minute TTL window; zero external dependencies or paid TURN/signaling servers.
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


-- ─── 11. RPC FUNCTIONS ───────────────────────────────────────

-- ── 11a. join_or_match ───────────────────────────────────────
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


-- ── 11b. check_match ─────────────────────────────────────────
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


-- ── 11c. get_room_info ───────────────────────────────────────
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


-- ── 11d. get_messages ────────────────────────────────────────
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


-- ── 11e. heartbeat ───────────────────────────────────────────
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


-- ── 11f. leave ───────────────────────────────────────────────
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


-- ── 11g. send_message ────────────────────────────────────────
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


-- ── 11h. block_partner ───────────────────────────────────────
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


-- ── 11i. report_partner ──────────────────────────────────────
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


-- ── 11j. admin_review_report ─────────────────────────────────
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


-- ─── 12. EXECUTION GRANTS ────────────────────────────────────
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

REVOKE ALL ON FUNCTION public.anonymous_send_signal(UUID,UUID,TEXT,JSONB) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_send_signal(UUID,UUID,TEXT,JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.anonymous_poll_signals(UUID,BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_poll_signals(UUID,BIGINT) TO authenticated;


-- ─── 13. SUPABASE REALTIME CONFIGURATION ─────────────────────
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
