-- =============================================================
-- CampusMate — Database Schema
-- PostgreSQL / Supabase
--
-- HOW TO RUN THIS:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. All tables, security rules and indexes will be created.
--
-- OVERVIEW OF TABLES:
--   profiles   → stores public user info (name, avatar, college)
--   tasks      → Academic Planner tasks and assignments
--   events     → CampusConnect events and workshops
--   lost_found → CampusFind lost & found posts
--   resources  → NoteNest study notes and links
-- =============================================================


-- ─── Enable UUID extension ──────────────────────────────────────────────────
-- Supabase already enables this by default, but we include it to be safe.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─── PROFILES ───────────────────────────────────────────────────────────────
-- One row per user. Automatically created when a user signs up (via trigger).
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

-- Auto-create a profile row when a new user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── TASKS ──────────────────────────────────────────────────────────────────
-- Academic Planner: assignments, projects, study sessions, etc.

CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  subject     TEXT,                         -- e.g. "Data Structures", "Physics"
  priority    TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high')),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed')),
  due_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx    ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx   ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_status_idx     ON public.tasks(status);


-- ─── EVENTS ─────────────────────────────────────────────────────────────────
-- CampusConnect: college events, workshops, hackathons, fests.

CREATE TABLE IF NOT EXISTS public.events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL DEFAULT 'general'
                     CHECK (category IN ('workshop', 'hackathon', 'fest', 'seminar', 'sports', 'cultural', 'general')),
  location         TEXT,
  event_date       TIMESTAMPTZ NOT NULL,
  registration_url TEXT,                    -- external link to sign up
  is_public        BOOLEAN DEFAULT TRUE,    -- visible to all users of the app
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS events_event_date_idx  ON public.events(event_date);
CREATE INDEX IF NOT EXISTS events_category_idx    ON public.events(category);
CREATE INDEX IF NOT EXISTS events_created_by_idx  ON public.events(created_by);


-- ─── LOST AND FOUND ─────────────────────────────────────────────────────────
-- CampusFind: posts for lost or found items on campus.

CREATE TABLE IF NOT EXISTS public.lost_found (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('lost', 'found')),
  item_name    TEXT NOT NULL,
  description  TEXT,
  location     TEXT NOT NULL,               -- where it was lost/found
  date_occurred DATE NOT NULL,              -- when it was lost/found
  image_url    TEXT,                        -- Supabase Storage URL
  contact_info TEXT,                        -- phone, email, or social handle
  is_resolved  BOOLEAN DEFAULT FALSE,       -- true once item is claimed/returned
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS lost_found_user_id_idx    ON public.lost_found(user_id);
CREATE INDEX IF NOT EXISTS lost_found_type_idx       ON public.lost_found(type);
CREATE INDEX IF NOT EXISTS lost_found_is_resolved_idx ON public.lost_found(is_resolved);


-- ─── RESOURCES ──────────────────────────────────────────────────────────────
-- NoteNest: study notes, lecture links, PDFs, YouTube videos, etc.

CREATE TABLE IF NOT EXISTS public.resources (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  subject      TEXT NOT NULL,               -- e.g. "Operating Systems"
  semester     INT CHECK (semester BETWEEN 1 AND 10),
  resource_type TEXT NOT NULL DEFAULT 'link'
                 CHECK (resource_type IN ('link', 'note', 'pdf', 'video', 'other')),
  url          TEXT,                        -- external link (YouTube, Drive, etc.)
  tags         TEXT[],                      -- array of tag strings
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS resources_user_id_idx  ON public.resources(user_id);
CREATE INDEX IF NOT EXISTS resources_subject_idx  ON public.resources(subject);
CREATE INDEX IF NOT EXISTS resources_semester_idx ON public.resources(semester);


-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================
-- RLS ensures users can only read/write their OWN data.
-- Without RLS, anyone with the anon key could read all rows.
-- =============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;


-- ── Profiles policies ──────────────────────────────────────────────────────
-- Users can view and edit only their own profile.

CREATE POLICY "profiles: users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- ── Tasks policies ─────────────────────────────────────────────────────────
-- Users can fully manage only their own tasks.

CREATE POLICY "tasks: users can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tasks: users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks: users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "tasks: users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);


-- ── Events policies ────────────────────────────────────────────────────────
-- Public events are visible to all logged-in users.
-- Only the creator can edit or delete their event.

CREATE POLICY "events: all logged-in users can view public events"
  ON public.events FOR SELECT
  USING (auth.role() = 'authenticated' AND is_public = TRUE);

CREATE POLICY "events: users can view own private events"
  ON public.events FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "events: users can insert own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "events: users can update own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "events: users can delete own events"
  ON public.events FOR DELETE
  USING (auth.uid() = created_by);


-- ── Lost and Found policies ────────────────────────────────────────────────
-- All logged-in users can browse posts (community board).
-- Only the poster can edit/delete their own post.

CREATE POLICY "lost_found: all logged-in users can view posts"
  ON public.lost_found FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "lost_found: users can insert own posts"
  ON public.lost_found FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lost_found: users can update own posts"
  ON public.lost_found FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "lost_found: users can delete own posts"
  ON public.lost_found FOR DELETE
  USING (auth.uid() = user_id);


-- ── Resources policies ─────────────────────────────────────────────────────
-- Users can only manage their own resources.

CREATE POLICY "resources: users can view own resources"
  ON public.resources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "resources: users can insert own resources"
  ON public.resources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "resources: users can update own resources"
  ON public.resources FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "resources: users can delete own resources"
  ON public.resources FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================
-- Done! All tables, indexes and security policies are created.
-- =============================================================
