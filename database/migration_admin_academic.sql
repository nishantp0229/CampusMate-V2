-- =============================================================
-- CampusMate — Migration: Hardened Admin System, Attendance & Timetable
--
-- INSTRUCTIONS:
-- 1. Review this script carefully.
-- 2. Open your Supabase Dashboard -> SQL Editor.
-- 3. Paste and run this script.
-- 4. To assign yourself as an Administrator, execute the snippet at the bottom.
-- =============================================================

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

-- Revoke write permissions from authenticated and anonymous users
-- Only postgres superuser / service role (e.g., Supabase SQL Editor) can grant admin roles
REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM authenticated, anon, public;


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
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;


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
-- Admins can view all events (including private) for moderation
DROP POLICY IF EXISTS "events: admins can view all events for moderation" ON public.events;
CREATE POLICY "events: admins can view all events for moderation"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Drop old update policies
DROP POLICY IF EXISTS "events: users can update own events" ON public.events;
DROP POLICY IF EXISTS "events: owners or admins can update" ON public.events;
DROP POLICY IF EXISTS "events: owners can update or admins can moderate" ON public.events;

CREATE POLICY "events: owners can update or admins can moderate"
  ON public.events FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (created_by = (SELECT auth.uid()) OR public.is_admin());

-- Drop old delete policies
DROP POLICY IF EXISTS "events: users can delete own events" ON public.events;
DROP POLICY IF EXISTS "events: owners or admins can delete" ON public.events;
DROP POLICY IF EXISTS "events: owners can delete or admins can moderate" ON public.events;

CREATE POLICY "events: owners can delete or admins can moderate"
  ON public.events FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()) OR public.is_admin());


-- ── 4b. Lost and Found Moderation ──
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


-- ─── 5. ATTENDANCE TABLE ─────────────────────────────────────
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


-- ─── 6. WEEKLY TIMETABLE TABLE ───────────────────────────────
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


-- ─── 7. HOW TO ASSIGN AN ADMINISTRATOR ACCOUNT: ──────────────
-- In Supabase -> SQL Editor, run this snippet with your user UUID:
--
-- INSERT INTO public.admin_users (user_id) 
-- VALUES ('<YOUR-AUTH-USER-UUID-HERE>')
-- ON CONFLICT (user_id) DO NOTHING;
