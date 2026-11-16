-- =============================================================
-- CampusMate — Phase A: Admin System, Attendance & Timetable
--
-- Review before running in the Supabase SQL Editor. Requires schema.sql.
-- This script does not delete existing records. Review any custom RLS policies
-- separately: PostgreSQL combines permissive policies with OR.
-- =============================================================

BEGIN;

-- Do not silently combine unknown policies with the rules below. Review and
-- resolve any policy reported by this check before applying the migration.
DO $$
DECLARE
  unexpected TEXT;
BEGIN
  SELECT string_agg(format('%I.%I: %s', schemaname, tablename, policyname), ', ')
  INTO unexpected
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('admin_users', 'events', 'lost_found', 'resources', 'attendance', 'timetable', 'moderation_actions')
    AND NOT (
      (tablename = 'admin_users' AND policyname = ANY (ARRAY[
        'admin_users: authenticated users can check admin status',
        'admin_users: users can check own admin status'
      ])) OR
      (tablename = 'events' AND policyname = ANY (ARRAY[
        'events: all logged-in users can view public events',
        'events: users can view own private events',
        'events: users can insert own events',
        'events: users can update own events',
        'events: owners or admins can update',
        'events: owners can update or admins can moderate',
        'events: users can delete own events',
        'events: owners or admins can delete',
        'events: owners can delete or admins can moderate',
        'events: admins can view all events for moderation'
      ])) OR
      (tablename = 'lost_found' AND policyname = ANY (ARRAY[
        'lost_found: all logged-in users can view posts',
        'lost_found: users can insert own posts',
        'lost_found: users can update own posts',
        'lost_found: owners or admins can update',
        'lost_found: owners can update or admins can moderate',
        'lost_found: users can delete own posts',
        'lost_found: owners or admins can delete',
        'lost_found: owners can delete or admins can moderate'
      ])) OR
      (tablename = 'resources' AND policyname = ANY (ARRAY[
        'resources: all logged-in users can view resources',
        'resources: users can insert own resources',
        'resources: users can update own resources',
        'resources: owners or admins can update',
        'resources: owners can update or admins can moderate',
        'resources: users can delete own resources',
        'resources: owners or admins can delete',
        'resources: owners can delete or admins can moderate'
      ])) OR
      (tablename = 'attendance' AND policyname = ANY (ARRAY[
        'attendance: students can view own records',
        'attendance: students can insert own records',
        'attendance: students can update own records',
        'attendance: students can delete own records'
      ])) OR
      (tablename = 'timetable' AND policyname = ANY (ARRAY[
        'timetable: students can view own timetable',
        'timetable: students can insert own timetable',
        'timetable: students can update own timetable',
        'timetable: students can delete own timetable'
      ])) OR
      (tablename = 'moderation_actions' AND policyname = 'moderation_actions: admins can view')
    );

  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'Review unexpected RLS policies before continuing: %', unexpected;
  END IF;
END;
$$;

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─── 1. SECURE ADMIN ROLE REGISTRY ───────────────────────────
-- Admins are stored in a dedicated table that normal users CANNOT insert into.
-- Only database superusers/service role (via SQL Editor) can grant admin privileges.

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on admin_users table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop legacy/previous policies
DROP POLICY IF EXISTS "admin_users: authenticated users can check admin status" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users: users can check own admin status" ON public.admin_users;

-- Normal students can ONLY check their own admin status (prevents enumerating all admins)
CREATE POLICY "admin_users: users can check own admin status"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Clients may only check their own membership. Only a trusted database role
-- may add or remove administrators.
REVOKE ALL ON public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id) ON public.admin_users TO authenticated;


-- ─── 2. HARDENED is_admin() FUNCTION ─────────────────────────
-- Secure helper function used in RLS policies and by frontend verification.
-- SECURITY DEFINER allows it to check admin status with search_path secured.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())
  );
$$;

-- Restrict execution to authenticated students and backend service role
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;


-- Aggregate counts only: no private profile or academic records are returned.
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS TABLE (
  total_profiles BIGINT,
  total_events BIGINT,
  total_lost_found BIGINT,
  total_resources BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM public.profiles),
    (SELECT COUNT(*) FROM public.events WHERE is_public IS TRUE),
    (SELECT COUNT(*) FROM public.lost_found),
    (SELECT COUNT(*) FROM public.resources);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_platform_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated;


-- ─── 3. IMMUTABLE POST OWNERSHIP TRIGGER ─────────────────────
-- Prevents both regular users and admins from transferring post ownership
-- by attempting to alter created_by or user_id columns on existing records.

CREATE OR REPLACE FUNCTION public.prevent_ownership_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'events' THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Ownership transfer not permitted: created_by cannot be modified.';
    END IF;
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Ownership transfer not permitted: user_id cannot be modified.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_events_creator_change ON public.events;
CREATE TRIGGER trg_prevent_events_creator_change
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ownership_change();

DROP TRIGGER IF EXISTS trg_prevent_lost_found_user_change ON public.lost_found;
CREATE TRIGGER trg_prevent_lost_found_user_change
  BEFORE UPDATE ON public.lost_found
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ownership_change();

DROP TRIGGER IF EXISTS trg_prevent_resources_user_change ON public.resources;
CREATE TRIGGER trg_prevent_resources_user_change
  BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ownership_change();


-- ─── 4. UPDATED RLS POLICIES FOR ADMIN MODERATION ─────────────
-- Normal students can update/delete only their own posts.
-- Admins can moderate other students' public content (events, lost & found, resources).
-- Drops both original schema.sql and previous migration policy names to prevent duplicate OR-chains.

-- ── 4a. Events Moderation ──
-- Restore the original public/owner SELECT policies. Admins do not gain access
-- to another student's private events.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events: all logged-in users can view public events" ON public.events;
CREATE POLICY "events: all logged-in users can view public events"
  ON public.events FOR SELECT TO authenticated
  USING (is_public IS TRUE);
DROP POLICY IF EXISTS "events: users can view own private events" ON public.events;
CREATE POLICY "events: users can view own private events"
  ON public.events FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS "events: admins can view all events for moderation" ON public.events;
DROP POLICY IF EXISTS "events: users can insert own events" ON public.events;
CREATE POLICY "events: users can insert own events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

-- Drop old update policies
DROP POLICY IF EXISTS "events: users can update own events" ON public.events;
DROP POLICY IF EXISTS "events: owners or admins can update" ON public.events;
DROP POLICY IF EXISTS "events: owners can update or admins can moderate" ON public.events;

CREATE POLICY "events: owners can update or admins can moderate"
  ON public.events FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (is_public IS TRUE AND public.is_admin()))
  WITH CHECK (created_by = (SELECT auth.uid()) OR (is_public IS TRUE AND public.is_admin()));

-- Drop old delete policies
DROP POLICY IF EXISTS "events: users can delete own events" ON public.events;
DROP POLICY IF EXISTS "events: owners or admins can delete" ON public.events;
DROP POLICY IF EXISTS "events: owners can delete or admins can moderate" ON public.events;

CREATE POLICY "events: owners can delete or admins can moderate"
  ON public.events FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (is_public IS TRUE AND public.is_admin()));


-- ── 4b. Lost and Found Moderation ──
ALTER TABLE public.lost_found ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lost_found: all logged-in users can view posts" ON public.lost_found;
CREATE POLICY "lost_found: all logged-in users can view posts"
  ON public.lost_found FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "lost_found: users can insert own posts" ON public.lost_found;
CREATE POLICY "lost_found: users can insert own posts"
  ON public.lost_found FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
-- Drop old update policies
DROP POLICY IF EXISTS "lost_found: users can update own posts" ON public.lost_found;
DROP POLICY IF EXISTS "lost_found: owners or admins can update" ON public.lost_found;
DROP POLICY IF EXISTS "lost_found: owners can update or admins can moderate" ON public.lost_found;

CREATE POLICY "lost_found: owners can update or admins can moderate"
  ON public.lost_found FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- Drop old delete policies
DROP POLICY IF EXISTS "lost_found: users can delete own posts" ON public.lost_found;
DROP POLICY IF EXISTS "lost_found: owners or admins can delete" ON public.lost_found;
DROP POLICY IF EXISTS "lost_found: owners can delete or admins can moderate" ON public.lost_found;

CREATE POLICY "lost_found: owners can delete or admins can moderate"
  ON public.lost_found FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());


-- ── 4c. Resources Moderation ──
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resources: all logged-in users can view resources" ON public.resources;
CREATE POLICY "resources: all logged-in users can view resources"
  ON public.resources FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "resources: users can insert own resources" ON public.resources;
CREATE POLICY "resources: users can insert own resources"
  ON public.resources FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
-- Drop old update policies
DROP POLICY IF EXISTS "resources: users can update own resources" ON public.resources;
DROP POLICY IF EXISTS "resources: owners or admins can update" ON public.resources;
DROP POLICY IF EXISTS "resources: owners can update or admins can moderate" ON public.resources;

CREATE POLICY "resources: owners can update or admins can moderate"
  ON public.resources FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- Drop old delete policies
DROP POLICY IF EXISTS "resources: users can delete own resources" ON public.resources;
DROP POLICY IF EXISTS "resources: owners or admins can delete" ON public.resources;
DROP POLICY IF EXISTS "resources: owners can delete or admins can moderate" ON public.resources;

CREATE POLICY "resources: owners can delete or admins can moderate"
  ON public.resources FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());


-- ─── 5. MODERATION AUDIT ─────────────────────────────────────
-- Records metadata only when an admin changes another student's public post.
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('events', 'lost_found', 'resources')),
  content_id  UUID NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('UPDATE', 'DELETE')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS moderation_actions_created_at_idx ON public.moderation_actions(created_at DESC);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_actions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.moderation_actions TO authenticated;
DROP POLICY IF EXISTS "moderation_actions: admins can view" ON public.moderation_actions;
CREATE POLICY "moderation_actions: admins can view"
  ON public.moderation_actions FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_moderation_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  post_owner UUID;
BEGIN
  IF TG_TABLE_NAME = 'events' THEN
    post_owner := OLD.created_by;
  ELSE
    post_owner := OLD.user_id;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> post_owner AND public.is_admin() THEN
    INSERT INTO public.moderation_actions (actor_id, content_type, content_id, action)
    VALUES (auth.uid(), TG_TABLE_NAME, OLD.id, TG_OP);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.log_moderation_action() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS log_events_moderation ON public.events;
CREATE TRIGGER log_events_moderation AFTER UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.log_moderation_action();
DROP TRIGGER IF EXISTS log_lost_found_moderation ON public.lost_found;
CREATE TRIGGER log_lost_found_moderation AFTER UPDATE OR DELETE ON public.lost_found
  FOR EACH ROW EXECUTE FUNCTION public.log_moderation_action();
DROP TRIGGER IF EXISTS log_resources_moderation ON public.resources;
CREATE TRIGGER log_resources_moderation AFTER UPDATE OR DELETE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.log_moderation_action();


-- ─── 6. ATTENDANCE TABLE ─────────────────────────────────────
-- Subject-wise attendance tracked privately per student.
-- Enforces: 0 <= attended_classes <= total_classes

CREATE TABLE IF NOT EXISTS public.attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject           TEXT NOT NULL,
  total_classes     INT NOT NULL DEFAULT 0 CHECK (total_classes >= 0),
  attended_classes  INT NOT NULL DEFAULT 0 CHECK (attended_classes >= 0 AND attended_classes <= total_classes),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT attendance_user_subject_unique UNIQUE (user_id, subject)
);

CREATE INDEX IF NOT EXISTS attendance_user_id_idx ON public.attendance(user_id);

DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attendance RLS: strictly private to each student (admins CANNOT view personal attendance)
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;

DROP POLICY IF EXISTS "attendance: students can view own records" ON public.attendance;
CREATE POLICY "attendance: students can view own records"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "attendance: students can insert own records" ON public.attendance;
CREATE POLICY "attendance: students can insert own records"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "attendance: students can update own records" ON public.attendance;
CREATE POLICY "attendance: students can update own records"
  ON public.attendance FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "attendance: students can delete own records" ON public.attendance;
CREATE POLICY "attendance: students can delete own records"
  ON public.attendance FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ─── 7. WEEKLY TIMETABLE TABLE ───────────────────────────────
-- Each student can organize their weekly class schedule.

CREATE TABLE IF NOT EXISTS public.timetable (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day         TEXT NOT NULL CHECK (day IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
  subject     TEXT NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  room        TEXT,
  instructor  TEXT,
  class_type  TEXT NOT NULL DEFAULT 'Class'
                CHECK (class_type IN ('Class', 'Lab', 'Tutorial', 'Seminar', 'Activity', 'Self Study')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT timetable_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS timetable_user_id_idx ON public.timetable(user_id);
CREATE INDEX IF NOT EXISTS timetable_day_idx ON public.timetable(day);

DROP TRIGGER IF EXISTS update_timetable_updated_at ON public.timetable;
CREATE TRIGGER update_timetable_updated_at
  BEFORE UPDATE ON public.timetable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Timetable RLS: strictly private to each student (admins CANNOT view personal timetable)
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.timetable FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable TO authenticated;

DROP POLICY IF EXISTS "timetable: students can view own timetable" ON public.timetable;
CREATE POLICY "timetable: students can view own timetable"
  ON public.timetable FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "timetable: students can insert own timetable" ON public.timetable;
CREATE POLICY "timetable: students can insert own timetable"
  ON public.timetable FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "timetable: students can update own timetable" ON public.timetable;
CREATE POLICY "timetable: students can update own timetable"
  ON public.timetable FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "timetable: students can delete own timetable" ON public.timetable;
CREATE POLICY "timetable: students can delete own timetable"
  ON public.timetable FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));


COMMIT;

-- ─── 8. HOW TO ASSIGN AN ADMINISTRATOR ACCOUNT: ──────────────
-- In Supabase -> SQL Editor, run this snippet with your user UUID:
--
-- INSERT INTO public.admin_users (user_id) 
-- VALUES ('<YOUR-AUTH-USER-UUID-HERE>')
-- ON CONFLICT (user_id) DO NOTHING;
