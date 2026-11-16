-- =============================================================
-- CampusMate — Phase C: TeamUp Migration
-- Student teammate-finding system for hackathons, projects,
-- competitions and college initiatives.
--
-- Security Hardened:
--   - Direct client writes (INSERT/UPDATE/DELETE) revoked on all tables
--   - SELECT only via strict Row Level Security (RLS)
--   - All mutations routed through SECURITY DEFINER RPCs with fixed search_path = ''
--   - Caller identity derived exclusively from auth.uid()
--   - Concurrency-safe atomic capacity checks with row-level locks
--   - Triggers preventing creator modification and leader removal
-- =============================================================

BEGIN;

-- Preflight check: Ensure base schema and profiles table exist, and detect any conflicting objects
DO $$
DECLARE
  v_name TEXT;
BEGIN
  -- 1. Base dependency validation
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Phase C TeamUp requires public.profiles from database/schema.sql.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'id'
      AND atttypid = 'uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Phase C TeamUp requires public.profiles.id UUID.';
  END IF;

  -- 2. Detect conflicting tables from an existing or unknown installation
  FOREACH v_name IN ARRAY ARRAY['teams', 'team_members', 'team_join_requests'] LOOP
    IF to_regclass(format('public.%I', v_name)) IS NOT NULL THEN
      RAISE EXCEPTION 'Existing table public.% conflicts with this first-install migration; inspect or backup before proceeding.', v_name;
    END IF;
  END LOOP;

  -- 3. Detect conflicting functions
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'teamup_update_timestamp',
      'teamup_guard_creator',
      'teamup_create_team',
      'teamup_update_team',
      'teamup_toggle_recruitment',
      'teamup_apply_to_team',
      'teamup_cancel_request',
      'teamup_respond_to_request',
      'teamup_remove_member',
      'teamup_leave_team',
      'teamup_delete_team'
    ])
  ) THEN
    RAISE EXCEPTION 'An existing TeamUp function conflicts with this first-install migration; inspect it before proceeding.';
  END IF;

  -- 4. Detect unexpected existing RLS policies on target table names
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY['teams', 'team_members', 'team_join_requests'])
  ) THEN
    RAISE EXCEPTION 'Unexpected RLS policies exist on TeamUp tables; inspect them before proceeding.';
  END IF;
END;
$$;

-- ─── 1. TEAMS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL CHECK (char_length(btrim(title)) >= 3 AND char_length(title) <= 100),
  description  TEXT NOT NULL CHECK (char_length(btrim(description)) >= 10 AND char_length(description) <= 2000),
  project_type TEXT NOT NULL CHECK (project_type IN ('Hackathon', 'Project', 'Competition', 'Other')),
  skills       TEXT[] NOT NULL DEFAULT '{}',
  max_members  INT NOT NULL CHECK (max_members >= 2 AND max_members <= 15),
  deadline     TIMESTAMPTZ,
  project_url  TEXT CHECK (project_url IS NULL OR project_url ~* '^https?://'),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'full')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_creator_idx ON public.teams (creator_id);
CREATE INDEX IF NOT EXISTS teams_status_idx ON public.teams (status, created_at DESC);
CREATE INDEX IF NOT EXISTS teams_type_idx ON public.teams (project_type);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.teamup_update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.teamup_update_timestamp();

-- Guard: Prevent changing team creator
CREATE OR REPLACE FUNCTION public.teamup_guard_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.creator_id <> NEW.creator_id THEN
    RAISE EXCEPTION 'Team creator cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_guard_creator ON public.teams;
CREATE TRIGGER trg_teams_guard_creator
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.teamup_guard_creator();


-- ─── 2. TEAM MEMBERS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_members_unique_membership UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_team_idx ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON public.team_members (user_id);

-- Leader protection is strictly enforced by revoking direct table writes and
-- guarding deletion within secure RPCs (teamup_remove_member & teamup_leave_team).
-- This allows native foreign key ON DELETE CASCADE from public.teams to execute
-- cleanly on team deletion.
DROP TRIGGER IF EXISTS trg_team_members_guard_leader ON public.team_members;
DROP FUNCTION IF EXISTS public.teamup_guard_leader_removal();


-- ─── 3. TEAM JOIN REQUESTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  introduction TEXT NOT NULL CHECK (char_length(btrim(introduction)) >= 5 AND char_length(introduction) <= 1000),
  skills       TEXT NOT NULL CHECK (char_length(btrim(skills)) >= 1 AND char_length(skills) <= 500),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index strictly enforces AT MOST ONE active pending request per (team, user)
CREATE UNIQUE INDEX IF NOT EXISTS team_join_requests_active_idx
  ON public.team_join_requests (team_id, user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_join_requests_team_idx ON public.team_join_requests (team_id, status);
CREATE INDEX IF NOT EXISTS team_join_requests_user_idx ON public.team_join_requests (user_id, status);

DROP TRIGGER IF EXISTS trg_team_join_requests_updated_at ON public.team_join_requests;
CREATE TRIGGER trg_team_join_requests_updated_at
  BEFORE UPDATE ON public.team_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.teamup_update_timestamp();


-- ─── 4. ROW LEVEL SECURITY & PERMISSION HARDENING ────────────
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;

-- Revoke all direct write privileges from clients on all tables
REVOKE ALL ON public.teams, public.team_members, public.team_join_requests
  FROM PUBLIC, anon, authenticated;

-- Grant SELECT only to authenticated users
GRANT SELECT ON public.teams, public.team_members, public.team_join_requests
  TO authenticated;

-- Clean up any legacy policies
DROP POLICY IF EXISTS "teamup_teams_select" ON public.teams;
DROP POLICY IF EXISTS "teamup_teams_insert" ON public.teams;
DROP POLICY IF EXISTS "teamup_teams_update" ON public.teams;
DROP POLICY IF EXISTS "teamup_teams_delete" ON public.teams;

DROP POLICY IF EXISTS "teamup_members_select" ON public.team_members;
DROP POLICY IF EXISTS "teamup_members_insert" ON public.team_members;
DROP POLICY IF EXISTS "teamup_members_delete" ON public.team_members;

DROP POLICY IF EXISTS "teamup_requests_select" ON public.team_join_requests;
DROP POLICY IF EXISTS "teamup_requests_insert" ON public.team_join_requests;
DROP POLICY IF EXISTS "teamup_requests_update" ON public.team_join_requests;
DROP POLICY IF EXISTS "teamup_requests_delete" ON public.team_join_requests;

-- Selective read-only policies
CREATE POLICY "teamup_teams_select"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "teamup_members_select"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "teamup_requests_select"
  ON public.team_join_requests
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.creator_id = (SELECT auth.uid())
    )
  );


-- ─── 5. SECURE ATOMIC RPC FUNCTIONS ──────────────────────────

-- 1. Create a Team (Creator is leader and first member atomically)
CREATE OR REPLACE FUNCTION public.teamup_create_team(
  p_title TEXT,
  p_description TEXT,
  p_project_type TEXT,
  p_skills TEXT[],
  p_max_members INT,
  p_deadline TIMESTAMPTZ DEFAULT NULL,
  p_project_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_team_id UUID;
  v_clean_title TEXT;
  v_clean_desc TEXT;
  v_clean_url TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_clean_title := pg_catalog.btrim(p_title);
  v_clean_desc := pg_catalog.btrim(p_description);
  v_clean_url := NULLIF(pg_catalog.btrim(p_project_url), '');

  IF pg_catalog.char_length(v_clean_title) < 3 OR pg_catalog.char_length(v_clean_title) > 100 THEN
    RAISE EXCEPTION 'Team title must be between 3 and 100 characters.';
  END IF;

  IF pg_catalog.char_length(v_clean_desc) < 10 OR pg_catalog.char_length(v_clean_desc) > 2000 THEN
    RAISE EXCEPTION 'Team description must be between 10 and 2000 characters.';
  END IF;

  IF p_project_type NOT IN ('Hackathon', 'Project', 'Competition', 'Other') THEN
    RAISE EXCEPTION 'Invalid project type: %', p_project_type;
  END IF;

  IF p_max_members < 2 OR p_max_members > 15 THEN
    RAISE EXCEPTION 'Team capacity must be between 2 and 15 members.';
  END IF;

  IF p_deadline IS NOT NULL AND p_deadline <= pg_catalog.now() THEN
    RAISE EXCEPTION 'Recruitment deadline must be in the future.';
  END IF;

  IF v_clean_url IS NOT NULL AND NOT (v_clean_url ~* '^https?://') THEN
    RAISE EXCEPTION 'Project URL must start with http:// or https://';
  END IF;

  INSERT INTO public.teams (
    creator_id,
    title,
    description,
    project_type,
    skills,
    max_members,
    deadline,
    project_url,
    status
  ) VALUES (
    v_uid,
    v_clean_title,
    v_clean_desc,
    p_project_type,
    COALESCE(p_skills, '{}'),
    p_max_members,
    p_deadline,
    v_clean_url,
    'open'
  )
  RETURNING id INTO v_team_id;

  INSERT INTO public.team_members (
    team_id,
    user_id,
    role
  ) VALUES (
    v_team_id,
    v_uid,
    'leader'
  );

  RETURN v_team_id;
END;
$$;


-- 2. Update a Team (Leader only, validates new capacity against confirmed member count)
CREATE OR REPLACE FUNCTION public.teamup_update_team(
  p_team_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_project_type TEXT,
  p_skills TEXT[],
  p_max_members INT,
  p_deadline TIMESTAMPTZ DEFAULT NULL,
  p_project_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_team RECORD;
  v_member_count INT;
  v_clean_title TEXT;
  v_clean_desc TEXT;
  v_clean_url TEXT;
  v_new_status TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found.';
  END IF;

  IF v_team.creator_id <> v_uid THEN
    RAISE EXCEPTION 'Only the team leader can edit this team.';
  END IF;

  v_clean_title := pg_catalog.btrim(p_title);
  v_clean_desc := pg_catalog.btrim(p_description);
  v_clean_url := NULLIF(pg_catalog.btrim(p_project_url), '');

  IF pg_catalog.char_length(v_clean_title) < 3 OR pg_catalog.char_length(v_clean_title) > 100 THEN
    RAISE EXCEPTION 'Team title must be between 3 and 100 characters.';
  END IF;

  IF pg_catalog.char_length(v_clean_desc) < 10 OR pg_catalog.char_length(v_clean_desc) > 2000 THEN
    RAISE EXCEPTION 'Team description must be between 10 and 2000 characters.';
  END IF;

  IF p_project_type NOT IN ('Hackathon', 'Project', 'Competition', 'Other') THEN
    RAISE EXCEPTION 'Invalid project type: %', p_project_type;
  END IF;

  IF p_max_members < 2 OR p_max_members > 15 THEN
    RAISE EXCEPTION 'Team capacity must be between 2 and 15 members.';
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM public.team_members
  WHERE team_id = p_team_id;

  IF p_max_members < v_member_count THEN
    RAISE EXCEPTION 'Cannot set capacity to % because team already has % members.', p_max_members, v_member_count;
  END IF;

  IF v_clean_url IS NOT NULL AND NOT (v_clean_url ~* '^https?://') THEN
    RAISE EXCEPTION 'Project URL must start with http:// or https://';
  END IF;

  v_new_status := v_team.status;
  IF v_member_count >= p_max_members THEN
    v_new_status := 'full';
  ELSIF v_team.status = 'full' AND v_member_count < p_max_members THEN
    v_new_status := 'open';
  END IF;

  UPDATE public.teams
  SET
    title = v_clean_title,
    description = v_clean_desc,
    project_type = p_project_type,
    skills = COALESCE(p_skills, '{}'),
    max_members = p_max_members,
    deadline = p_deadline,
    project_url = v_clean_url,
    status = v_new_status
  WHERE id = p_team_id;

  RETURN TRUE;
END;
$$;


-- 3. Toggle Recruitment Status (Leader only: open <-> closed)
CREATE OR REPLACE FUNCTION public.teamup_toggle_recruitment(
  p_team_id UUID,
  p_status TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_team RECORD;
  v_member_count INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_status NOT IN ('open', 'closed') THEN
    RAISE EXCEPTION 'Status must be open or closed.';
  END IF;

  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found.';
  END IF;

  IF v_team.creator_id <> v_uid THEN
    RAISE EXCEPTION 'Only the team leader can change recruitment status.';
  END IF;

  IF p_status = 'open' THEN
    SELECT COUNT(*) INTO v_member_count
    FROM public.team_members
    WHERE team_id = p_team_id;

    IF v_member_count >= v_team.max_members THEN
      RAISE EXCEPTION 'Cannot reopen recruitment: team is already full (% of % members).', v_member_count, v_team.max_members;
    END IF;
  END IF;

  UPDATE public.teams
  SET status = p_status
  WHERE id = p_team_id;

  RETURN p_status;
END;
$$;


-- 4. Apply to Join a Team (Prevents duplicates, full team applications, and expired deadlines)
CREATE OR REPLACE FUNCTION public.teamup_apply_to_team(
  p_team_id UUID,
  p_introduction TEXT,
  p_skills TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_team RECORD;
  v_clean_intro TEXT;
  v_clean_skills TEXT;
  v_request_id UUID;
  v_member_count INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_clean_intro := pg_catalog.btrim(p_introduction);
  v_clean_skills := pg_catalog.btrim(p_skills);

  IF pg_catalog.char_length(v_clean_intro) < 5 OR pg_catalog.char_length(v_clean_intro) > 1000 THEN
    RAISE EXCEPTION 'Introduction pitch must be between 5 and 1000 characters.';
  END IF;

  IF pg_catalog.char_length(v_clean_skills) < 1 OR pg_catalog.char_length(v_clean_skills) > 500 THEN
    RAISE EXCEPTION 'Skills must be between 1 and 500 characters.';
  END IF;

  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found.';
  END IF;

  IF v_team.status <> 'open' THEN
    RAISE EXCEPTION 'Recruitment for this team is %.', v_team.status;
  END IF;

  IF v_team.deadline IS NOT NULL AND v_team.deadline < pg_catalog.now() THEN
    RAISE EXCEPTION 'The recruitment deadline for this team has passed.';
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'You are already a member of this team.';
  END IF;

  -- Check if duplicate active application exists
  IF EXISTS (
    SELECT 1 FROM public.team_join_requests
    WHERE team_id = p_team_id AND user_id = v_uid AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending join request for this team.';
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_member_count
  FROM public.team_members
  WHERE team_id = p_team_id;

  IF v_member_count >= v_team.max_members THEN
    RAISE EXCEPTION 'Team is already full.';
  END IF;

  INSERT INTO public.team_join_requests (
    team_id,
    user_id,
    introduction,
    skills,
    status
  ) VALUES (
    p_team_id,
    v_uid,
    v_clean_intro,
    v_clean_skills,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;


-- 5. Cancel a Join Request (Applicant only, must be pending)
CREATE OR REPLACE FUNCTION public.teamup_cancel_request(
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_req RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_req
  FROM public.team_join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found.';
  END IF;

  IF v_req.user_id <> v_uid THEN
    RAISE EXCEPTION 'You can only cancel your own join requests.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending join requests can be cancelled.';
  END IF;

  UPDATE public.team_join_requests
  SET status = 'cancelled'
  WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;


-- 6. Respond to Join Request (Leader only: accept / reject, atomic capacity check)
CREATE OR REPLACE FUNCTION public.teamup_respond_to_request(
  p_request_id UUID,
  p_decision TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_req RECORD;
  v_team RECORD;
  v_member_count INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be accepted or rejected.';
  END IF;

  SELECT * INTO v_req
  FROM public.team_join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'This join request is already %.', v_req.status;
  END IF;

  SELECT * INTO v_team
  FROM public.teams
  WHERE id = v_req.team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found.';
  END IF;

  IF v_team.creator_id <> v_uid THEN
    RAISE EXCEPTION 'Only the team leader can respond to join requests.';
  END IF;

  IF p_decision = 'rejected' THEN
    UPDATE public.team_join_requests
    SET status = 'rejected'
    WHERE id = p_request_id;
    RETURN TRUE;
  END IF;

  -- Decision is 'accepted': Check capacity under lock
  SELECT COUNT(*) INTO v_member_count
  FROM public.team_members
  WHERE team_id = v_team.id;

  IF v_member_count >= v_team.max_members THEN
    RAISE EXCEPTION 'Cannot accept member: team has already reached its maximum limit (% members).', v_team.max_members;
  END IF;

  -- Add member if not already present
  INSERT INTO public.team_members (
    team_id,
    user_id,
    role
  ) VALUES (
    v_team.id,
    v_req.user_id,
    'member'
  )
  ON CONFLICT (team_id, user_id) DO NOTHING;

  -- Mark request as accepted
  UPDATE public.team_join_requests
  SET status = 'accepted'
  WHERE id = p_request_id;

  -- Check if team is now full
  IF v_member_count + 1 >= v_team.max_members THEN
    UPDATE public.teams
    SET status = 'full'
    WHERE id = v_team.id;
  END IF;

  RETURN TRUE;
END;
$$;


-- 7. Remove Team Member (Leader only, cannot remove self)
CREATE OR REPLACE FUNCTION public.teamup_remove_member(
  p_team_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_team RECORD;
  v_member_count INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found.';
  END IF;

  IF v_team.creator_id <> v_uid THEN
    RAISE EXCEPTION 'Only the team leader can remove members.';
  END IF;

  IF p_user_id = v_uid OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id AND role = 'leader'
  ) THEN
    RAISE EXCEPTION 'Cannot remove team leader from team members. Dissolve the team instead.';
  END IF;

  DELETE FROM public.team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;

  -- If status was full, reopen it
  IF v_team.status = 'full' THEN
    SELECT COUNT(*) INTO v_member_count
    FROM public.team_members
    WHERE team_id = p_team_id;

    IF v_member_count < v_team.max_members THEN
      UPDATE public.teams SET status = 'open' WHERE id = p_team_id;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;


-- 8. Leave Team (Member only; leader cannot leave without dissolving/deleting)
CREATE OR REPLACE FUNCTION public.teamup_leave_team(
  p_team_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_team RECORD;
  v_member_count INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found.';
  END IF;

  IF v_team.creator_id = v_uid OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = v_uid AND role = 'leader'
  ) THEN
    RAISE EXCEPTION 'Team leaders cannot leave their team. You can delete the team from the management panel.';
  END IF;

  DELETE FROM public.team_members
  WHERE team_id = p_team_id AND user_id = v_uid;

  -- If status was full, reopen it
  IF v_team.status = 'full' THEN
    SELECT COUNT(*) INTO v_member_count
    FROM public.team_members
    WHERE team_id = p_team_id;

    IF v_member_count < v_team.max_members THEN
      UPDATE public.teams SET status = 'open' WHERE id = p_team_id;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;


-- 9. Delete Team (Leader only, cascades to members and join requests)
CREATE OR REPLACE FUNCTION public.teamup_delete_team(
  p_team_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_team RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found.';
  END IF;

  IF v_team.creator_id <> v_uid THEN
    RAISE EXCEPTION 'Only the team leader can delete this team.';
  END IF;

  DELETE FROM public.teams
  WHERE id = p_team_id;

  RETURN TRUE;
END;
$$;


-- ─── 6. EXECUTION GRANTS ─────────────────────────────────────
-- Revoke execution from PUBLIC on all triggers and functions
REVOKE EXECUTE ON FUNCTION public.teamup_update_timestamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teamup_guard_creator() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.teamup_create_team(TEXT, TEXT, TEXT, TEXT[], INT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teamup_create_team(TEXT, TEXT, TEXT, TEXT[], INT, TIMESTAMPTZ, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teamup_update_team(UUID, TEXT, TEXT, TEXT, TEXT[], INT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teamup_update_team(UUID, TEXT, TEXT, TEXT, TEXT[], INT, TIMESTAMPTZ, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teamup_toggle_recruitment(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teamup_toggle_recruitment(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teamup_apply_to_team(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teamup_apply_to_team(UUID, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teamup_cancel_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teamup_cancel_request(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teamup_respond_to_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teamup_respond_to_request(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teamup_remove_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teamup_remove_member(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teamup_leave_team(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teamup_leave_team(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teamup_delete_team(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teamup_delete_team(UUID) TO authenticated;

COMMIT;
