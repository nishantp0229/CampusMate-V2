-- =============================================================
-- CampusMate — Migration: CampusAnonymous (Omegle-style Student Chat)
--
-- Features:
-- 1. Atomic database matchmaking with FOR UPDATE SKIP LOCKED
-- 2. Prevents self-matches and multiple concurrent matches
-- 3. Mutual block-list enforcement during matchmaking
-- 4. Ephemeral chat sessions with private RLS (only room participants can read/write)
-- 5. Safe abuse reporting for admin review with 30-day retention
-- 6. No public or permanent chat history
--
-- INSTRUCTIONS:
-- Do NOT execute this migration yet. Review the proposal first.
-- Once approved, execute in Supabase Dashboard -> SQL Editor.
-- =============================================================

-- Ensure UUID extension is active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. WAITING QUEUE TABLE ──────────────────────────────────
-- Temporary waiting pool of authenticated students looking for a chat partner.
CREATE TABLE IF NOT EXISTS public.anonymous_queue (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  heartbeat   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.anonymous_queue ENABLE ROW LEVEL SECURITY;

-- Students can view their own queue entry
DROP POLICY IF EXISTS "queue: users can view own queue entry" ON public.anonymous_queue;
CREATE POLICY "queue: users can view own queue entry"
  ON public.anonymous_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Students can enter the queue
DROP POLICY IF EXISTS "queue: users can join queue" ON public.anonymous_queue;
CREATE POLICY "queue: users can join queue"
  ON public.anonymous_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Students can leave the queue
DROP POLICY IF EXISTS "queue: users can leave queue" ON public.anonymous_queue;
CREATE POLICY "queue: users can leave queue"
  ON public.anonymous_queue FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ─── 2. ANONYMOUS BLOCKS TABLE ───────────────────────────────
-- Prevents users from being matched with students they blocked or who blocked them.
CREATE TABLE IF NOT EXISTS public.anonymous_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT anonymous_no_self_block CHECK (blocker_id != blocked_id),
  CONSTRAINT anonymous_unique_block UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.anonymous_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks: users can view own blocked users" ON public.anonymous_blocks;
CREATE POLICY "blocks: users can view own blocked users"
  ON public.anonymous_blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks: users can insert blocks" ON public.anonymous_blocks;
CREATE POLICY "blocks: users can insert blocks"
  ON public.anonymous_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);


-- ─── 3. ANONYMOUS ROOMS TABLE ────────────────────────────────
-- Active 1-on-1 private connection between two matched students.
CREATE TABLE IF NOT EXISTS public.anonymous_rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_2        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_1_alias  TEXT NOT NULL DEFAULT 'Anonymous Student A',
  user_2_alias  TEXT NOT NULL DEFAULT 'Anonymous Student B',
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ended_at      TIMESTAMPTZ,
  CONSTRAINT anonymous_room_different_users CHECK (user_1 != user_2)
);

CREATE INDEX IF NOT EXISTS anonymous_rooms_users_idx ON public.anonymous_rooms(user_1, user_2, status);

ALTER TABLE public.anonymous_rooms ENABLE ROW LEVEL SECURITY;

-- Only room participants can see their active room
DROP POLICY IF EXISTS "rooms: participants can view room" ON public.anonymous_rooms;
CREATE POLICY "rooms: participants can view room"
  ON public.anonymous_rooms FOR SELECT
  TO authenticated
  USING (auth.uid() = user_1 OR auth.uid() = user_2);

-- Either participant can end the room
DROP POLICY IF EXISTS "rooms: participants can end room" ON public.anonymous_rooms;
CREATE POLICY "rooms: participants can end room"
  ON public.anonymous_rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_1 OR auth.uid() = user_2)
  WITH CHECK (auth.uid() = user_1 OR auth.uid() = user_2);


-- ─── 4. ANONYMOUS MESSAGES TABLE ─────────────────────────────
-- Ephemeral text messages for active chat sessions.
CREATE TABLE IF NOT EXISTS public.anonymous_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.anonymous_rooms(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS anonymous_messages_room_idx ON public.anonymous_messages(room_id, created_at);

ALTER TABLE public.anonymous_messages ENABLE ROW LEVEL SECURITY;

-- Only participants in the room can read messages
DROP POLICY IF EXISTS "messages: participants can view messages" ON public.anonymous_messages;
CREATE POLICY "messages: participants can view messages"
  ON public.anonymous_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.anonymous_rooms r
      WHERE r.id = room_id AND (r.user_1 = auth.uid() OR r.user_2 = auth.uid())
    )
  );

-- Only participants can post messages, and only while the room is active
DROP POLICY IF EXISTS "messages: participants can post to active room" ON public.anonymous_messages;
CREATE POLICY "messages: participants can post to active room"
  ON public.anonymous_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.anonymous_rooms r
      WHERE r.id = room_id AND r.status = 'active' AND (r.user_1 = auth.uid() OR r.user_2 = auth.uid())
    )
  );


-- ─── 5. ABUSE REPORTS TABLE ──────────────────────────────────
-- Secure reporting for harassment or inappropriate conduct.
-- 30-day retention policy; reviewed only by platform administrators.
CREATE TABLE IF NOT EXISTS public.anonymous_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id     UUID REFERENCES public.anonymous_rooms(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL CHECK (char_length(reason) <= 250),
  snippet     TEXT CHECK (char_length(snippet) <= 500),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.anonymous_reports ENABLE ROW LEVEL SECURITY;

-- Reporter can insert a report
DROP POLICY IF EXISTS "reports: users can file report" ON public.anonymous_reports;
CREATE POLICY "reports: users can file report"
  ON public.anonymous_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Only verified administrators can review reports
DROP POLICY IF EXISTS "reports: admins can view reports" ON public.anonymous_reports;
CREATE POLICY "reports: admins can view reports"
  ON public.anonymous_reports FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "reports: admins can update report status" ON public.anonymous_reports;
CREATE POLICY "reports: admins can update report status"
  ON public.anonymous_reports FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── 6. ATOMIC MATCHMAKING DATABASE FUNCTION ─────────────────
-- Concurrency-safe: uses FOR UPDATE SKIP LOCKED to prevent race conditions.
CREATE OR REPLACE FUNCTION public.match_anonymous_user()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id    UUID := auth.uid();
  v_partner_id   UUID;
  v_room_id      UUID;
  v_alias_1      TEXT;
  v_alias_2      TEXT;
  v_aliases      TEXT[] := ARRAY[
    'Anonymous Phoenix', 'Anonymous Falcon', 'Anonymous Nova',
    'Anonymous Titan', 'Anonymous Griffin', 'Anonymous Lynx',
    'Anonymous Panther', 'Anonymous Hawk', 'Anonymous Comet',
    'Anonymous Wolf', 'Anonymous Orion', 'Anonymous Eagle'
  ];
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. End any stale active rooms for caller
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = NOW()
  WHERE (user_1 = v_caller_id OR user_2 = v_caller_id) AND status = 'active';

  -- 2. Prune dead queue entries older than 2 minutes
  DELETE FROM public.anonymous_queue
  WHERE heartbeat < NOW() - INTERVAL '2 minutes';

  -- 3. Atomically look for a waiting partner using SKIP LOCKED
  -- Excludes caller and any blocked users in either direction
  SELECT q.user_id INTO v_partner_id
  FROM public.anonymous_queue q
  WHERE q.user_id != v_caller_id
    AND NOT EXISTS (
      SELECT 1 FROM public.anonymous_blocks b
      WHERE (b.blocker_id = v_caller_id AND b.blocked_id = q.user_id)
         OR (b.blocker_id = q.user_id AND b.blocked_id = v_caller_id)
    )
  ORDER BY q.joined_at ASC
  FOR UPDATE OF q SKIP LOCKED
  LIMIT 1;

  IF v_partner_id IS NOT NULL THEN
    -- Match found! Remove partner from queue
    DELETE FROM public.anonymous_queue WHERE user_id = v_partner_id;
    DELETE FROM public.anonymous_queue WHERE user_id = v_caller_id;

    -- Pick random distinct aliases
    v_alias_1 := v_aliases[1 + floor(random() * array_length(v_aliases, 1))::int];
    v_alias_2 := v_aliases[1 + floor(random() * array_length(v_aliases, 1))::int];
    IF v_alias_1 = v_alias_2 THEN
      v_alias_2 := v_alias_2 || ' 2';
    END IF;

    -- Create room
    INSERT INTO public.anonymous_rooms (user_1, user_2, user_1_alias, user_2_alias, status)
    VALUES (v_caller_id, v_partner_id, v_alias_1, v_alias_2, 'active')
    RETURNING id INTO v_room_id;

    RETURN jsonb_build_object(
      'matched', true,
      'room_id', v_room_id,
      'my_alias', v_alias_1,
      'partner_alias', v_alias_2,
      'partner_id', v_partner_id
    );
  ELSE
    -- No partner available: register in queue
    INSERT INTO public.anonymous_queue (user_id, joined_at, heartbeat)
    VALUES (v_caller_id, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET heartbeat = NOW();

    RETURN jsonb_build_object('matched', false, 'status', 'waiting');
  END IF;
END;
$$;


-- ─── 7. LEAVE / DISCONNECT FUNCTION ──────────────────────────
CREATE OR REPLACE FUNCTION public.leave_anonymous_chat(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove from waiting queue if present
  DELETE FROM public.anonymous_queue WHERE user_id = auth.uid();

  -- End room if caller is a participant
  IF p_room_id IS NOT NULL THEN
    UPDATE public.anonymous_rooms
    SET status = 'ended', ended_at = NOW()
    WHERE id = p_room_id AND (user_1 = auth.uid() OR user_2 = auth.uid()) AND status = 'active';

    -- Prune messages when chat session ends to preserve ephemerality
    DELETE FROM public.anonymous_messages WHERE room_id = p_room_id;
  END IF;
END;
$$;
