-- =============================================================
-- CampusMate — Phase D: CampusMarket Migration
-- Secure campus-only student marketplace.
--
-- Security Hardened:
--   - Direct client writes (INSERT/UPDATE/DELETE) revoked on all tables
--   - SELECT only via strict Row Level Security (RLS)
--   - All mutations routed through SECURITY DEFINER RPCs with fixed search_path = ''
--   - Caller identity derived exclusively from auth.uid()
--   - Safe preflight checks detecting collisions
--   - PostgreSQL btrim compatibility throughout
--   - Storage bucket configuration with MIME-type and 5MB size limits
-- =============================================================

BEGIN;

-- Safe preflight check: Ensure base schema and profiles table exist, and detect any conflicting objects
DO $$
DECLARE
  v_name TEXT;
BEGIN
  -- 1. Base dependency validation
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Phase D CampusMarket requires public.profiles from database/schema.sql.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'id'
      AND atttypid = 'uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Phase D CampusMarket requires public.profiles.id UUID.';
  END IF;

  -- 2. Detect conflicting tables from an existing or unknown installation
  FOREACH v_name IN ARRAY ARRAY['market_listings', 'market_listing_reports'] LOOP
    IF to_regclass(format('public.%I', v_name)) IS NOT NULL THEN
      RAISE EXCEPTION 'Existing table public.% conflicts with this first-install migration; inspect or backup before proceeding.', v_name;
    END IF;
  END LOOP;

  -- 3. Detect conflicting functions
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'market_update_timestamp',
      'market_guard_seller',
      'market_is_admin',
      'market_create_listing',
      'market_update_listing',
      'market_toggle_status',
      'market_delete_listing',
      'market_report_listing',
      'market_admin_review_report'
    ])
  ) THEN
    RAISE EXCEPTION 'An existing CampusMarket function conflicts with this first-install migration; inspect it before proceeding.';
  END IF;

  -- 4. Detect conflicting or unexpected storage bucket
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE id = 'campus-market' AND name <> 'campus-market'
    ) THEN
      RAISE EXCEPTION 'An unrelated storage bucket with ID campus-market exists with a different name. Inspect before proceeding.';
    END IF;
  END IF;

  -- 5. Detect unexpected existing RLS policies on target table names
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY['market_listings', 'market_listing_reports'])
  ) THEN
    RAISE EXCEPTION 'Unexpected RLS policies exist on CampusMarket tables; inspect them before proceeding.';
  END IF;
END;
$$;


-- ─── 1. MARKET LISTINGS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_listings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title              TEXT NOT NULL CHECK (char_length(btrim(title)) >= 3 AND char_length(title) <= 100),
  description        TEXT NOT NULL CHECK (char_length(btrim(description)) >= 10 AND char_length(description) <= 2000),
  price              NUMERIC(10, 2) NOT NULL CHECK (price >= 0 AND price <= 100000),
  category           TEXT NOT NULL CHECK (category IN ('Books', 'Electronics', 'Accessories', 'Hostel Essentials', 'Other')),
  condition          TEXT NOT NULL CHECK (condition IN ('New', 'Like New', 'Good', 'Fair')),
  images             TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(images) <= 3),
  contact_preference TEXT NOT NULL DEFAULT 'CampusCommunity DM' CHECK (contact_preference IN ('CampusCommunity DM', 'Meet on Campus', 'Either')),
  status             TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_listings_seller_idx ON public.market_listings (seller_id);
CREATE INDEX IF NOT EXISTS market_listings_status_idx ON public.market_listings (status, created_at DESC);
CREATE INDEX IF NOT EXISTS market_listings_category_idx ON public.market_listings (category);
CREATE INDEX IF NOT EXISTS market_listings_price_idx ON public.market_listings (price);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.market_update_timestamp()
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

DROP TRIGGER IF EXISTS trg_market_listings_updated_at ON public.market_listings;
CREATE TRIGGER trg_market_listings_updated_at
  BEFORE UPDATE ON public.market_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.market_update_timestamp();

-- Guard: Prevent changing listing seller
CREATE OR REPLACE FUNCTION public.market_guard_seller()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.seller_id <> NEW.seller_id THEN
    RAISE EXCEPTION 'Listing seller cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_market_listings_guard_seller ON public.market_listings;
CREATE TRIGGER trg_market_listings_guard_seller
  BEFORE UPDATE ON public.market_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.market_guard_seller();


-- ─── 2. MARKET LISTING REPORTS ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_listing_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (char_length(btrim(reason)) >= 5 AND char_length(reason) <= 500),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index strictly enforces AT MOST ONE active pending report per (listing, reporter)
CREATE UNIQUE INDEX IF NOT EXISTS market_listing_reports_unique_pending_idx
  ON public.market_listing_reports (listing_id, reporter_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS market_reports_listing_idx ON public.market_listing_reports (listing_id, status);
CREATE INDEX IF NOT EXISTS market_reports_reporter_idx ON public.market_listing_reports (reporter_id);

DROP TRIGGER IF EXISTS trg_market_reports_updated_at ON public.market_listing_reports;
CREATE TRIGGER trg_market_reports_updated_at
  BEFORE UPDATE ON public.market_listing_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.market_update_timestamp();


-- ─── 3. ROW LEVEL SECURITY & PERMISSION HARDENING ────────────
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_listing_reports ENABLE ROW LEVEL SECURITY;

-- Helper: Robust admin verification that reuses existing admin_users / is_admin()
CREATE OR REPLACE FUNCTION public.market_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_uid UUID;
  v_is_adm BOOLEAN := FALSE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check if public.is_admin() exists from Phase A (via dynamic SQL to prevent compile-time failure)
  IF to_regprocedure('public.is_admin()') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_admin()' INTO v_is_adm;
    RETURN COALESCE(v_is_adm, FALSE);
  END IF;

  -- 2. Fall back to directly checking the admin_users table
  IF to_regclass('public.admin_users') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = $1)'
    INTO v_is_adm
    USING v_uid;
    RETURN COALESCE(v_is_adm, FALSE);
  END IF;

  RETURN FALSE;
END;
$$;

-- Revoke all direct write privileges from clients on all tables
REVOKE ALL ON public.market_listings, public.market_listing_reports
  FROM PUBLIC, anon, authenticated;

-- Grant SELECT only to authenticated users
GRANT SELECT ON public.market_listings, public.market_listing_reports
  TO authenticated;

-- Clean up any legacy policies
DROP POLICY IF EXISTS "market_listings_select" ON public.market_listings;
DROP POLICY IF EXISTS "market_reports_select" ON public.market_listing_reports;

-- Selective read-only policies
CREATE POLICY "market_listings_select"
  ON public.market_listings
  FOR SELECT
  TO authenticated
  USING (true);

-- Reports: Only the reporting student or an administrator can view reports
CREATE POLICY "market_reports_select"
  ON public.market_listing_reports
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = reporter_id
    OR public.market_is_admin()
  );


-- ─── 4. STORAGE BUCKET CONFIGURATION & POLICIES ──────────────
-- Provision private 'campus-market' bucket with 5MB max file size and image mime-types only
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'campus-market') THEN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'campus-market',
        'campus-market',
        false, -- Private bucket: access restricted to authenticated campus students
        5242880, -- 5 MB limit
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      );
    ELSE
      -- Safely update the expected campus-market bucket to private without modifying unrelated buckets
      UPDATE storage.buckets
      SET
        public = false,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      WHERE id = 'campus-market' AND name = 'campus-market';
    END IF;
  END IF;
END;
$$;

-- Storage policies on storage.objects (Private bucket)
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "campus_market_storage_select" ON storage.objects;
    DROP POLICY IF EXISTS "campus_market_storage_insert" ON storage.objects;
    DROP POLICY IF EXISTS "campus_market_storage_update" ON storage.objects;
    DROP POLICY IF EXISTS "campus_market_storage_delete" ON storage.objects;

    -- Only authenticated students can view images in private campus-market bucket
    CREATE POLICY "campus_market_storage_select"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'campus-market');

    -- Authenticated students can only upload images into their own folder (user_id/...)
    CREATE POLICY "campus_market_storage_insert"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'campus-market'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      );

    -- Authenticated students can only update/delete images in their own folder
    CREATE POLICY "campus_market_storage_update"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'campus-market'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      );

    CREATE POLICY "campus_market_storage_delete"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'campus-market'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      );
  END IF;
END;
$$;


-- ─── 5. SECURE ATOMIC RPC FUNCTIONS ──────────────────────────

-- 1. Create a Listing
CREATE OR REPLACE FUNCTION public.market_create_listing(
  p_title TEXT,
  p_description TEXT,
  p_price NUMERIC,
  p_category TEXT,
  p_condition TEXT,
  p_images TEXT[] DEFAULT '{}',
  p_contact_preference TEXT DEFAULT 'CampusCommunity DM'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_listing_id UUID;
  v_clean_title TEXT;
  v_clean_desc TEXT;
  v_clean_pref TEXT;
  v_img TEXT;
  v_obj_valid BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_clean_title := pg_catalog.btrim(p_title);
  v_clean_desc := pg_catalog.btrim(p_description);
  v_clean_pref := COALESCE(NULLIF(pg_catalog.btrim(p_contact_preference), ''), 'CampusCommunity DM');

  IF pg_catalog.char_length(v_clean_title) < 3 OR pg_catalog.char_length(v_clean_title) > 100 THEN
    RAISE EXCEPTION 'Item title must be between 3 and 100 characters.';
  END IF;

  IF pg_catalog.char_length(v_clean_desc) < 10 OR pg_catalog.char_length(v_clean_desc) > 2000 THEN
    RAISE EXCEPTION 'Item description must be between 10 and 2000 characters.';
  END IF;

  IF p_price IS NULL OR p_price < 0 OR p_price > 100000 THEN
    RAISE EXCEPTION 'Price must be between ₹0 and ₹1,00,000.';
  END IF;

  IF p_category NOT IN ('Books', 'Electronics', 'Accessories', 'Hostel Essentials', 'Other') THEN
    RAISE EXCEPTION 'Invalid category: %', p_category;
  END IF;

  IF p_condition NOT IN ('New', 'Like New', 'Good', 'Fair') THEN
    RAISE EXCEPTION 'Invalid condition: %', p_condition;
  END IF;

  IF v_clean_pref NOT IN ('CampusCommunity DM', 'Meet on Campus', 'Either') THEN
    RAISE EXCEPTION 'Invalid contact preference: %', v_clean_pref;
  END IF;

  IF p_images IS NOT NULL AND pg_catalog.cardinality(p_images) > 3 THEN
    RAISE EXCEPTION 'A listing can have at most 3 images.';
  END IF;

  -- Validate images: max 3, no blob: URLs, no external URLs, must belong to seller's folder
  IF p_images IS NOT NULL THEN
    FOREACH v_img IN ARRAY p_images LOOP
      v_img := pg_catalog.btrim(v_img);

      IF v_img ~* '^blob:' THEN
        RAISE EXCEPTION 'Temporary blob URLs cannot be persisted. Upload images to storage first.';
      END IF;

      IF v_img ~* '^https?://' THEN
        RAISE EXCEPTION 'External image URLs are not permitted. Store Supabase Storage paths within your folder.';
      END IF;

      -- Must strictly match <v_uid>/<safe_filename>
      IF NOT (v_img ~* ('^' || v_uid::text || '/[a-zA-Z0-9_\-\.]+$')) THEN
        RAISE EXCEPTION 'Invalid image path: %. All images must be stored in your authenticated user folder (%/).', v_img, v_uid;
      END IF;

      -- Verify storage object existence and ownership in storage.objects if storage extension is active
      IF to_regclass('storage.objects') IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM storage.objects
          WHERE bucket_id = 'campus-market'
            AND name = v_img
            AND (storage.foldername(name))[1] = v_uid::text
        ) INTO v_obj_valid;

        IF NOT v_obj_valid THEN
          RAISE EXCEPTION 'Image object not found in storage or does not belong to your folder: %', v_img;
        END IF;

        IF EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = 'storage.objects'::regclass
            AND attname = 'owner_id'
            AND NOT attisdropped
        ) THEN
          EXECUTE 'SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = ''campus-market'' AND name = $1 AND owner_id = $2)'
          INTO v_obj_valid
          USING v_img, v_uid::text;
          IF NOT v_obj_valid THEN
            RAISE EXCEPTION 'Image object ownership mismatch: %', v_img;
          END IF;
        ELSIF EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = 'storage.objects'::regclass
            AND attname = 'owner'
            AND NOT attisdropped
        ) THEN
          EXECUTE 'SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = ''campus-market'' AND name = $1 AND owner::text = $2)'
          INTO v_obj_valid
          USING v_img, v_uid::text;
          IF NOT v_obj_valid THEN
            RAISE EXCEPTION 'Image object ownership mismatch: %', v_img;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.market_listings (
    seller_id,
    title,
    description,
    price,
    category,
    condition,
    images,
    contact_preference,
    status
  ) VALUES (
    v_uid,
    v_clean_title,
    v_clean_desc,
    p_price,
    p_category,
    p_condition,
    COALESCE(p_images, '{}'),
    v_clean_pref,
    'available'
  )
  RETURNING id INTO v_listing_id;

  RETURN v_listing_id;
END;
$$;


-- 2. Update a Listing (Seller only)
CREATE OR REPLACE FUNCTION public.market_update_listing(
  p_listing_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_price NUMERIC,
  p_category TEXT,
  p_condition TEXT,
  p_images TEXT[] DEFAULT '{}',
  p_contact_preference TEXT DEFAULT 'CampusCommunity DM'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_listing RECORD;
  v_clean_title TEXT;
  v_clean_desc TEXT;
  v_clean_pref TEXT;
  v_img TEXT;
  v_obj_valid BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_listing.seller_id <> v_uid THEN
    RAISE EXCEPTION 'Only the seller can edit this listing.';
  END IF;

  v_clean_title := pg_catalog.btrim(p_title);
  v_clean_desc := pg_catalog.btrim(p_description);
  v_clean_pref := COALESCE(NULLIF(pg_catalog.btrim(p_contact_preference), ''), 'CampusCommunity DM');

  IF pg_catalog.char_length(v_clean_title) < 3 OR pg_catalog.char_length(v_clean_title) > 100 THEN
    RAISE EXCEPTION 'Item title must be between 3 and 100 characters.';
  END IF;

  IF pg_catalog.char_length(v_clean_desc) < 10 OR pg_catalog.char_length(v_clean_desc) > 2000 THEN
    RAISE EXCEPTION 'Item description must be between 10 and 2000 characters.';
  END IF;

  IF p_price IS NULL OR p_price < 0 OR p_price > 100000 THEN
    RAISE EXCEPTION 'Price must be between ₹0 and ₹1,00,000.';
  END IF;

  IF p_category NOT IN ('Books', 'Electronics', 'Accessories', 'Hostel Essentials', 'Other') THEN
    RAISE EXCEPTION 'Invalid category: %', p_category;
  END IF;

  IF p_condition NOT IN ('New', 'Like New', 'Good', 'Fair') THEN
    RAISE EXCEPTION 'Invalid condition: %', p_condition;
  END IF;

  IF v_clean_pref NOT IN ('CampusCommunity DM', 'Meet on Campus', 'Either') THEN
    RAISE EXCEPTION 'Invalid contact preference: %', v_clean_pref;
  END IF;

  IF p_images IS NOT NULL AND pg_catalog.cardinality(p_images) > 3 THEN
    RAISE EXCEPTION 'A listing can have at most 3 images.';
  END IF;

  -- Validate images: max 3, no blob: URLs, no external URLs, must belong to seller's folder
  IF p_images IS NOT NULL THEN
    FOREACH v_img IN ARRAY p_images LOOP
      v_img := pg_catalog.btrim(v_img);

      IF v_img ~* '^blob:' THEN
        RAISE EXCEPTION 'Temporary blob URLs cannot be persisted. Upload images to storage first.';
      END IF;

      IF v_img ~* '^https?://' THEN
        RAISE EXCEPTION 'External image URLs are not permitted. Store Supabase Storage paths within your folder.';
      END IF;

      -- Must strictly match <v_uid>/<safe_filename>
      IF NOT (v_img ~* ('^' || v_uid::text || '/[a-zA-Z0-9_\-\.]+$')) THEN
        RAISE EXCEPTION 'Invalid image path: %. All images must be stored in your authenticated user folder (%/).', v_img, v_uid;
      END IF;

      -- Verify storage object existence and ownership in storage.objects if storage extension is active
      IF to_regclass('storage.objects') IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM storage.objects
          WHERE bucket_id = 'campus-market'
            AND name = v_img
            AND (storage.foldername(name))[1] = v_uid::text
        ) INTO v_obj_valid;

        IF NOT v_obj_valid THEN
          RAISE EXCEPTION 'Image object not found in storage or does not belong to your folder: %', v_img;
        END IF;

        IF EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = 'storage.objects'::regclass
            AND attname = 'owner_id'
            AND NOT attisdropped
        ) THEN
          EXECUTE 'SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = ''campus-market'' AND name = $1 AND owner_id = $2)'
          INTO v_obj_valid
          USING v_img, v_uid::text;
          IF NOT v_obj_valid THEN
            RAISE EXCEPTION 'Image object ownership mismatch: %', v_img;
          END IF;
        ELSIF EXISTS (
          SELECT 1 FROM pg_attribute
          WHERE attrelid = 'storage.objects'::regclass
            AND attname = 'owner'
            AND NOT attisdropped
        ) THEN
          EXECUTE 'SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = ''campus-market'' AND name = $1 AND owner::text = $2)'
          INTO v_obj_valid
          USING v_img, v_uid::text;
          IF NOT v_obj_valid THEN
            RAISE EXCEPTION 'Image object ownership mismatch: %', v_img;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.market_listings
  SET
    title = v_clean_title,
    description = v_clean_desc,
    price = p_price,
    category = p_category,
    condition = p_condition,
    images = COALESCE(p_images, '{}'),
    contact_preference = v_clean_pref
  WHERE id = p_listing_id;

  RETURN TRUE;
END;
$$;


-- 3. Toggle Status (Seller only: available <-> sold)
CREATE OR REPLACE FUNCTION public.market_toggle_status(
  p_listing_id UUID,
  p_status TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_listing RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_status NOT IN ('available', 'sold') THEN
    RAISE EXCEPTION 'Status must be available or sold.';
  END IF;

  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_listing.seller_id <> v_uid THEN
    RAISE EXCEPTION 'Only the seller can change listing status.';
  END IF;

  UPDATE public.market_listings
  SET status = p_status
  WHERE id = p_listing_id;

  RETURN p_status;
END;
$$;


-- 4. Delete a Listing (Seller only, or Admin)
CREATE OR REPLACE FUNCTION public.market_delete_listing(
  p_listing_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_listing RECORD;
  v_is_adm BOOLEAN := FALSE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_listing.seller_id <> v_uid AND NOT public.market_is_admin() THEN
    RAISE EXCEPTION 'Only the seller or an administrator can delete this listing.';
  END IF;

  DELETE FROM public.market_listings
  WHERE id = p_listing_id;

  RETURN TRUE;
END;
$$;


-- 5. Report a Listing (Student reporting suspicious/inappropriate listing)
CREATE OR REPLACE FUNCTION public.market_report_listing(
  p_listing_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_listing RECORD;
  v_clean_reason TEXT;
  v_report_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_clean_reason := pg_catalog.btrim(p_reason);
  IF pg_catalog.char_length(v_clean_reason) < 5 OR pg_catalog.char_length(v_clean_reason) > 500 THEN
    RAISE EXCEPTION 'Report reason must be between 5 and 500 characters.';
  END IF;

  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_listing.seller_id = v_uid THEN
    RAISE EXCEPTION 'You cannot report your own listing.';
  END IF;

  -- Prevent duplicate active pending reports
  IF EXISTS (
    SELECT 1 FROM public.market_listing_reports
    WHERE listing_id = p_listing_id AND reporter_id = v_uid AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You have already reported this listing.';
  END IF;

  INSERT INTO public.market_listing_reports (
    listing_id,
    reporter_id,
    reason,
    status
  ) VALUES (
    p_listing_id,
    v_uid,
    v_clean_reason,
    'pending'
  )
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;


-- 6. Admin Review of a Listing Report
CREATE OR REPLACE FUNCTION public.market_admin_review_report(
  p_report_id UUID,
  p_status TEXT
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.market_is_admin() THEN
    RAISE EXCEPTION 'Only administrators can review reports.';
  END IF;

  IF p_status NOT IN ('reviewed', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid report status. Allowed: reviewed, dismissed.';
  END IF;

  UPDATE public.market_listing_reports
  SET status = p_status,
      updated_at = pg_catalog.clock_timestamp()
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found.';
  END IF;

  RETURN TRUE;
END;
$$;


-- ─── 6. EXECUTION GRANTS ─────────────────────────────────────
-- Revoke execution from PUBLIC on all triggers and functions
REVOKE EXECUTE ON FUNCTION public.market_update_timestamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.market_guard_seller() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.market_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.market_create_listing(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_create_listing(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT[], TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.market_update_listing(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_update_listing(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT[], TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.market_toggle_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_toggle_status(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.market_delete_listing(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_delete_listing(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.market_report_listing(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_report_listing(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.market_admin_review_report(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_admin_review_report(UUID, TEXT) TO authenticated;

COMMIT;
