-- =============================================================
-- CampusMate — CampusMarket Completion Patch
-- Safe, additive, non-destructive patch for Phase D.
--
-- Actions:
-- 1. Provisions the private 'campus-market' storage bucket if missing.
-- 2. Verifies existing named policies, then adds missing policies.
-- 3. Installs the market_admin_review_report() RPC function.
--
-- Prerequisites:
-- - Phase A (public.admin_users, public.is_admin())
-- - Phase D base tables (public.market_listings, public.market_listing_reports)
--
-- Safety:
-- - Never drops or replaces existing storage policies or tables.
-- - Restrictive policies protect this bucket even if other permissive policies
--   grant broader storage access. Unrelated buckets are not restricted.
-- - All authenticated users can read/sign every campus-market image, including
--   unlisted or orphaned uploads; "student" means anyone assigned that role.
-- - Does not alter existing listings, reports, objects, or unrelated buckets.
-- =============================================================

BEGIN;

-- ─── 0. PREFLIGHT DEPENDENCY CHECK ───────────────────────────
DO $$
BEGIN
  -- Verify base table exists
  IF to_regclass('public.market_listings') IS NULL OR to_regclass('public.market_listing_reports') IS NULL THEN
    RAISE EXCEPTION 'Phase D base tables (market_listings, market_listing_reports) must be installed first.';
  END IF;

  IF to_regprocedure('public.market_is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Phase D function public.market_is_admin() must exist.';
  END IF;
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL
     OR to_regprocedure('storage.foldername(text)') IS NULL THEN
    RAISE EXCEPTION 'Supabase Storage buckets, objects, and foldername(text) are required.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = 'storage.objects'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'RLS must be enabled on storage.objects.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'storage.objects'::regclass AND attname = 'owner_id'
      AND atttypid = 'text'::regtype AND attnum > 0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'storage.objects.owner_id text is required for seller ownership checks.';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'campus-market' AND name IS DISTINCT FROM 'campus-market') THEN
    RAISE EXCEPTION 'Bucket ID campus-market has a different name; inspect it before proceeding.';
  END IF;
END;
$$;


-- ─── 1. STORAGE POLICY PREFLIGHT AND ADDITIVE CREATION ────────
-- Compile policy expressions against a temporary table of matching column
-- types. Comparing PostgreSQL's parsed/deparsed expressions, commands, roles,
-- and permissiveness rejects modified definitions (including OR true), rather
-- than trusting names or brittle substring matching.
CREATE TEMP TABLE campus_market_policy_template (
  bucket_id TEXT, name TEXT, owner_id TEXT
) ON COMMIT DROP;

DO $$
DECLARE
  v_spec RECORD;
  v_template RECORD;
  v_existing RECORD;
  v_sql TEXT;
BEGIN
  FOR v_spec IN
    SELECT * FROM (VALUES
      ('campus_market_storage_select', 'PERMISSIVE', 'SELECT', 'authenticated',
       $e$bucket_id = 'campus-market'$e$, NULL::text),
      ('campus_market_storage_insert', 'PERMISSIVE', 'INSERT', 'authenticated', NULL::text,
       $e$bucket_id = 'campus-market' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)$e$),
      ('campus_market_storage_update', 'PERMISSIVE', 'UPDATE', 'authenticated',
       $e$bucket_id = 'campus-market' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)$e$,
       $e$bucket_id = 'campus-market' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)$e$),
      ('campus_market_storage_delete', 'PERMISSIVE', 'DELETE', 'authenticated',
       $e$bucket_id = 'campus-market' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)$e$, NULL::text),
      ('campus_market_guard_select', 'RESTRICTIVE', 'SELECT', 'public',
       $e$bucket_id <> 'campus-market' OR (current_user = 'authenticated' AND (SELECT auth.uid()) IS NOT NULL)$e$, NULL::text),
      ('campus_market_guard_insert', 'RESTRICTIVE', 'INSERT', 'public', NULL::text,
       $e$bucket_id <> 'campus-market' OR (current_user = 'authenticated' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text) AND owner_id = (SELECT auth.uid()::text))$e$),
      ('campus_market_guard_update', 'RESTRICTIVE', 'UPDATE', 'public',
       $e$bucket_id <> 'campus-market' OR (current_user = 'authenticated' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text) AND owner_id = (SELECT auth.uid()::text))$e$,
       $e$bucket_id <> 'campus-market' OR (current_user = 'authenticated' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text) AND owner_id = (SELECT auth.uid()::text))$e$),
      ('campus_market_guard_delete', 'RESTRICTIVE', 'DELETE', 'public',
       $e$bucket_id <> 'campus-market' OR (current_user = 'authenticated' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text) AND owner_id = (SELECT auth.uid()::text))$e$, NULL::text)
    ) AS policies(policy_name, mode, command, role_name, using_expr, check_expr)
  LOOP
    v_sql := pg_catalog.format('CREATE POLICY %I ON pg_temp.campus_market_policy_template AS %s FOR %s TO %I',
      v_spec.policy_name, v_spec.mode, v_spec.command, v_spec.role_name);
    -- PUBLIC is a keyword, not the role named "public".
    IF v_spec.role_name = 'public' THEN
      v_sql := pg_catalog.format('CREATE POLICY %I ON pg_temp.campus_market_policy_template AS %s FOR %s TO PUBLIC',
        v_spec.policy_name, v_spec.mode, v_spec.command);
    END IF;
    IF v_spec.using_expr IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_spec.using_expr || ')'; END IF;
    IF v_spec.check_expr IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_spec.check_expr || ')'; END IF;
    EXECUTE v_sql;

    SELECT p.polcmd, p.polpermissive, p.polroles,
           pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS using_expr,
           pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    INTO v_template FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'pg_temp.campus_market_policy_template'::regclass AND p.polname = v_spec.policy_name;

    SELECT p.polcmd, p.polpermissive, p.polroles,
           pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS using_expr,
           pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    INTO v_existing FROM pg_catalog.pg_policy p
    WHERE p.polrelid = 'storage.objects'::regclass AND p.polname = v_spec.policy_name;
    IF FOUND AND (
      v_existing.polcmd IS DISTINCT FROM v_template.polcmd OR
      v_existing.polpermissive IS DISTINCT FROM v_template.polpermissive OR
      v_existing.polroles IS DISTINCT FROM v_template.polroles OR
      v_existing.using_expr IS DISTINCT FROM v_template.using_expr OR
      (CASE WHEN v_existing.polcmd = 'w'
        THEN COALESCE(v_existing.check_expr, v_existing.using_expr)
        ELSE v_existing.check_expr END)
        IS DISTINCT FROM v_template.check_expr
    ) THEN
      RAISE EXCEPTION 'CampusMarket storage policy "%" has an unexpected definition; inspect it before proceeding.', v_spec.policy_name;
    END IF;
  END LOOP;

  -- Every existing named policy has now passed preflight.
  FOR v_spec IN
    SELECT p.polname, p.polcmd, p.polpermissive, p.polroles,
           pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS using_expr,
           pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    FROM pg_catalog.pg_policy p WHERE p.polrelid = 'pg_temp.campus_market_policy_template'::regclass
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy p
      WHERE p.polrelid = 'storage.objects'::regclass AND p.polname = v_spec.polname
    ) THEN
      v_sql := pg_catalog.format('CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s',
        v_spec.polname, CASE WHEN v_spec.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        CASE v_spec.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' END,
        CASE WHEN v_spec.polpermissive THEN 'authenticated' ELSE 'PUBLIC' END);
      IF v_spec.using_expr IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_spec.using_expr || ')'; END IF;
      IF v_spec.check_expr IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_spec.check_expr || ')'; END IF;
      EXECUTE v_sql;
    END IF;
  END LOOP;
END;
$$;

-- ─── 2. STORAGE BUCKET PROVISIONING ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('campus-market', 'campus-market', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE storage.buckets.name = 'campus-market';

-- Fail closed if a concurrent bucket creation or unexpected configuration
-- prevented the intended private settings from being applied.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'campus-market' AND name = 'campus-market' AND public IS FALSE
      AND file_size_limit = 5242880
      AND allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ) THEN
    RAISE EXCEPTION 'CampusMarket bucket could not be configured safely; inspect the existing bucket.';
  END IF;
END;
$$;


-- ─── 3. ADMIN REVIEW RPC FUNCTION ────────────────────────────
-- Installs/updates the report review function for the Admin Console.
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

  IF public.market_is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only administrators can review reports.';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('reviewed', 'dismissed') THEN
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

REVOKE EXECUTE ON FUNCTION public.market_admin_review_report(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_admin_review_report(UUID, TEXT) TO authenticated;

COMMIT;
