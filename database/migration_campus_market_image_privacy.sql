-- CampusMarket image privacy: additive restrictions only.
-- Requires the Market base and completion migrations to be installed already.
-- Existing policies, buckets, objects and listings are never dropped/changed.
BEGIN;

DO $$
BEGIN
  IF pg_catalog.to_regclass('public.market_listings') IS NULL
     OR pg_catalog.to_regclass('storage.objects') IS NULL
     OR pg_catalog.to_regclass('storage.buckets') IS NULL
     OR pg_catalog.to_regprocedure('public.market_is_admin()') IS NULL
     OR pg_catalog.to_regprocedure('storage.foldername(text)') IS NULL THEN
    RAISE EXCEPTION 'Market listings, admin verification and Supabase Storage are required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'campus-market' AND name = 'campus-market' AND public IS FALSE
  ) THEN
    RAISE EXCEPTION 'The existing campus-market bucket must already be private.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'storage.objects'::regclass AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'public.market_listings'::regclass AND relrowsecurity
  ) OR NOT pg_catalog.has_table_privilege('authenticated', 'public.market_listings', 'SELECT')
    OR NOT pg_catalog.has_table_privilege('authenticated', 'storage.objects', 'SELECT') THEN
    RAISE EXCEPTION 'Storage and listings RLS and authenticated SELECT grants are required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'storage.objects'::regclass AND attname = 'owner_id'
      AND atttypid = 'text'::regtype AND attnum > 0 AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.market_listings'::regclass AND attname = 'images'
      AND atttypid = 'text[]'::regtype AND attnum > 0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Expected storage.objects.owner_id and market_listings.images types are required.';
  END IF;
  IF pg_catalog.to_regprocedure('public.market_image_has_visible_listing(text)') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_policy
       WHERE polrelid = 'storage.objects'::regclass
         AND polname IN (
           'campus_market_guard_authenticated_read', 'campus_market_guard_visible_images',
           'campus_market_allow_visible_read', 'campus_market_guard_owned_insert',
           'campus_market_guard_owned_update', 'campus_market_guard_owned_delete'
         )
     ) THEN
    RAISE EXCEPTION 'Market image-privacy objects already exist; inspect rather than replacing them.';
  END IF;
END;
$$;

-- SECURITY INVOKER is deliberate: the listing lookup follows the caller's
-- actual market_listings RLS. In the reviewed base, SELECT USING (true) makes
-- both available and sold listings visible to authenticated users.
CREATE FUNCTION public.market_image_has_visible_listing(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.market_listings l
    WHERE l.images @> ARRAY[p_path]::TEXT[]
  );
$$;
REVOKE ALL ON FUNCTION public.market_image_has_visible_listing(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_image_has_visible_listing(TEXT) TO authenticated;

-- A restrictive policy cannot grant access by itself. Add a narrowly scoped
-- permissive policy so authorized reads do not depend on an unknown existing
-- permissive policy. Other restrictive policies may still deny access.
CREATE POLICY campus_market_allow_visible_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'campus-market'
    AND (
      (owner_id = (SELECT auth.uid()::text)
       AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
      OR (SELECT public.market_is_admin())
      OR public.market_image_has_visible_listing(name)
    )
  );

-- Defense in depth against broad existing permissive Storage policies. This
-- guard touches only the target bucket and applies to all non-bypass roles.
CREATE POLICY campus_market_guard_authenticated_read
  ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (
    bucket_id IS DISTINCT FROM 'campus-market'
    OR (current_user = 'authenticated' AND (SELECT auth.uid()) IS NOT NULL)
  );

-- This policy is restrictive, so it intersects rather than replaces existing
-- permissive policies. Sellers can see their own unsaved uploads, admins use
-- the existing Market admin function, and other students see only images
-- referenced by listings they can themselves SELECT.
CREATE POLICY campus_market_guard_visible_images
  ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    bucket_id IS DISTINCT FROM 'campus-market'
    OR (
      (owner_id = (SELECT auth.uid()::text)
       AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
      OR (SELECT public.market_is_admin())
      OR public.market_image_has_visible_listing(name)
    )
  );

-- Independently constrain writes even if another permissive policy is broad
-- or the prior completion policy differs. These guards neither grant access
-- nor affect unrelated buckets. UPDATE checks both the old and new row.
CREATE POLICY campus_market_guard_owned_insert
  ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (
    bucket_id IS DISTINCT FROM 'campus-market'
    OR (current_user = 'authenticated'
        AND owner_id = (SELECT auth.uid()::text)
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  );

CREATE POLICY campus_market_guard_owned_update
  ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING (
    bucket_id IS DISTINCT FROM 'campus-market'
    OR (current_user = 'authenticated'
        AND owner_id = (SELECT auth.uid()::text)
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  )
  WITH CHECK (
    bucket_id IS DISTINCT FROM 'campus-market'
    OR (current_user = 'authenticated'
        AND owner_id = (SELECT auth.uid()::text)
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  );

CREATE POLICY campus_market_guard_owned_delete
  ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC
  USING (
    bucket_id IS DISTINCT FROM 'campus-market'
    OR (current_user = 'authenticated'
        AND owner_id = (SELECT auth.uid()::text)
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  );

COMMIT;
