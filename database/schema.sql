-- =============================================================
-- CampusMate — Database Schema
-- PostgreSQL / Supabase
--
-- HOW TO RUN THIS:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. All tables, security rules, indexes, and triggers will be created.
--   4. Safely rerunnable at any time without data loss.
--
-- OVERVIEW OF TABLES:
--   profiles   → stores student details (name, avatar, college, dept, sem)
--   tasks      → Academic Planner tasks and assignments
--   events     → CampusConnect events, workshops and fests
--   lost_found → CampusFind lost & found posts
--   resources  → NoteNest study notes, slides and links
-- =============================================================

-- Enable UUID extension (included for full compatibility across Postgres versions)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean up any legacy view if previously created
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- ─── Helper: Auto-update updated_at timestamp ────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─── 1. PROFILES ─────────────────────────────────────────────
-- One row per student. Automatically created when a user signs up.
-- Linked to Supabase Auth via auth.users(id).

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  college     TEXT,
  department  TEXT,
  semester    INT CHECK (semester BETWEEN 1 AND 10),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-create/update profile row when a new user registers in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    avatar_url = CASE WHEN EXCLUDED.avatar_url <> '' THEN EXCLUDED.avatar_url ELSE public.profiles.avatar_url END,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─── 2. TASKS ────────────────────────────────────────────────
-- Academic Planner: assignments, projects, study sessions, etc.

CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  subject     TEXT,                         -- e.g. "Data Structures", "Physics"
  priority    TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high')),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed')),
  due_date    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx    ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx   ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_status_idx     ON public.tasks(status);

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─── 3. EVENTS ───────────────────────────────────────────────
-- CampusConnect: college events, workshops, hackathons, fests, sports.

CREATE TABLE IF NOT EXISTS public.events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL DEFAULT 'general'
                     CHECK (category IN ('workshop', 'hackathon', 'fest', 'seminar', 'sports', 'cultural', 'academic', 'technical', 'general')),
  location         TEXT,
  event_date       TIMESTAMPTZ NOT NULL,
  registration_url TEXT,                    -- external link to sign up
  organizer        TEXT,                    -- club / student chapter name
  image_url        TEXT,                    -- event banner image URL
  is_public        BOOLEAN DEFAULT TRUE,    -- visible to all users of the app
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS events_event_date_idx  ON public.events(event_date);
CREATE INDEX IF NOT EXISTS events_category_idx    ON public.events(category);
CREATE INDEX IF NOT EXISTS events_created_by_idx  ON public.events(created_by);

DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─── 4. LOST AND FOUND ───────────────────────────────────────
-- CampusFind: posts for lost or found items on campus.

CREATE TABLE IF NOT EXISTS public.lost_found (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('lost', 'found')),
  category      TEXT NOT NULL DEFAULT 'Other'
                  CHECK (category IN ('Electronics', 'Accessories', 'Documents', 'Books', 'Other')),
  location_tag  TEXT DEFAULT 'Other',       -- e.g. Library, Canteen, Hostel, Labs, Auditorium
  item_name     TEXT NOT NULL,
  description   TEXT,
  location      TEXT NOT NULL,              -- detailed location description
  date_occurred TIMESTAMPTZ NOT NULL,       -- when it was lost/found
  image_url     TEXT,                       -- item photo URL
  contact_name  TEXT,                       -- poster display name (e.g. "Rahul V.")
  contact_info  TEXT,                       -- public pickup instructions (e.g. "Handed over to Central Library 2nd floor desk"); NOT for private phone/email
  is_resolved   BOOLEAN DEFAULT FALSE,      -- true once item is claimed/returned
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS lost_found_user_id_idx     ON public.lost_found(user_id);
CREATE INDEX IF NOT EXISTS lost_found_type_idx        ON public.lost_found(type);
CREATE INDEX IF NOT EXISTS lost_found_category_idx    ON public.lost_found(category);
CREATE INDEX IF NOT EXISTS lost_found_is_resolved_idx ON public.lost_found(is_resolved);

DROP TRIGGER IF EXISTS update_lost_found_updated_at ON public.lost_found;
CREATE TRIGGER update_lost_found_updated_at
  BEFORE UPDATE ON public.lost_found
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─── 5. RESOURCES ────────────────────────────────────────────
-- NoteNest: study notes, lecture links, PDFs, YouTube videos, etc.

CREATE TABLE IF NOT EXISTS public.resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  subject       TEXT NOT NULL,              -- e.g. "Operating Systems"
  semester      INT CHECK (semester BETWEEN 1 AND 10),
  resource_type TEXT NOT NULL DEFAULT 'link'
                  CHECK (resource_type IN ('link', 'note', 'pdf', 'video', 'other')),
  url           TEXT,                       -- external link (YouTube, Drive, etc.)
  tags          TEXT[],                     -- array of tag strings
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS resources_user_id_idx  ON public.resources(user_id);
CREATE INDEX IF NOT EXISTS resources_subject_idx  ON public.resources(subject);
CREATE INDEX IF NOT EXISTS resources_semester_idx ON public.resources(semester);

DROP TRIGGER IF EXISTS update_resources_updated_at ON public.resources;
CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================
-- RLS ensures users can only access and modify authorized rows.
-- Every policy is dropped and recreated to guarantee rerunnability.
-- =============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources  ENABLE ROW LEVEL SECURITY;


-- ── Profiles policies ────────────────────────────────────────
-- Strictly private: students can view, insert and update only their own profile.
-- Personal student details (department, semester) remain protected and accessible only by the owner.

DROP POLICY IF EXISTS "profiles: users can view own profile" ON public.profiles;
CREATE POLICY "profiles: users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: users can insert own profile" ON public.profiles;
CREATE POLICY "profiles: users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: users can update own profile" ON public.profiles;
CREATE POLICY "profiles: users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ── Tasks policies ───────────────────────────────────────────
-- Strictly private: students can view, insert, update and delete only their own tasks.
-- WITH CHECK prevents transferring task ownership to another user.

DROP POLICY IF EXISTS "tasks: users can view own tasks" ON public.tasks;
CREATE POLICY "tasks: users can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks: users can insert own tasks" ON public.tasks;
CREATE POLICY "tasks: users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks: users can update own tasks" ON public.tasks;
CREATE POLICY "tasks: users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tasks: users can delete own tasks" ON public.tasks;
CREATE POLICY "tasks: users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);


-- ── Events policies ──────────────────────────────────────────
-- Public events are visible to all logged-in students.
-- Only the event creator can edit or delete their event.
-- WITH CHECK prevents changing the event creator ID on update.

DROP POLICY IF EXISTS "events: all logged-in users can view public events" ON public.events;
CREATE POLICY "events: all logged-in users can view public events"
  ON public.events FOR SELECT
  USING (auth.role() = 'authenticated' AND is_public = TRUE);

DROP POLICY IF EXISTS "events: users can view own private events" ON public.events;
CREATE POLICY "events: users can view own private events"
  ON public.events FOR SELECT
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "events: users can insert own events" ON public.events;
CREATE POLICY "events: users can insert own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "events: users can update own events" ON public.events;
CREATE POLICY "events: users can update own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "events: users can delete own events" ON public.events;
CREATE POLICY "events: users can delete own events"
  ON public.events FOR DELETE
  USING (auth.uid() = created_by);


-- ── Lost and Found policies ──────────────────────────────────
-- Community board: all logged-in students can view lost & found listings.
-- Only the poster can edit or delete their own listing.
-- WITH CHECK prevents changing post ownership to another user.

DROP POLICY IF EXISTS "lost_found: all logged-in users can view posts" ON public.lost_found;
CREATE POLICY "lost_found: all logged-in users can view posts"
  ON public.lost_found FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lost_found: users can insert own posts" ON public.lost_found;
CREATE POLICY "lost_found: users can insert own posts"
  ON public.lost_found FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lost_found: users can update own posts" ON public.lost_found;
CREATE POLICY "lost_found: users can update own posts"
  ON public.lost_found FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lost_found: users can delete own posts" ON public.lost_found;
CREATE POLICY "lost_found: users can delete own posts"
  ON public.lost_found FOR DELETE
  USING (auth.uid() = user_id);


-- ── Resources policies ───────────────────────────────────────
-- Study vault: all logged-in students can view shared notes and study materials.
-- Only the uploader can edit or delete their own resource.
-- WITH CHECK prevents changing the uploader ID on update.

DROP POLICY IF EXISTS "resources: all logged-in users can view resources" ON public.resources;
CREATE POLICY "resources: all logged-in users can view resources"
  ON public.resources FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "resources: users can insert own resources" ON public.resources;
CREATE POLICY "resources: users can insert own resources"
  ON public.resources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "resources: users can update own resources" ON public.resources;
CREATE POLICY "resources: users can update own resources"
  ON public.resources FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "resources: users can delete own resources" ON public.resources;
CREATE POLICY "resources: users can delete own resources"
  ON public.resources FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- Done! All tables, triggers, and security policies ready.
-- =============================================================
