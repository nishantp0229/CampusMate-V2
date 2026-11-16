# CampusMarket: review and installation guide

This guide is based on local source inspection. No database, bucket, policy, or
grant has been verified in Supabase. It is not authorization to apply SQL.
Do not rerun `migration_campus_market.sql`, even for this investigation.
Do not run the obsolete `migration_anonymous_chat.sql`. Message cleanup must
remain disabled; signaling-expiry cron requires separate approval and is outside
this Market-only guide.

## What must already exist

- The reviewed Market base: `public.market_listings`,
  `public.market_listing_reports`, `public.market_is_admin()` and the Market
  RPCs listed below, with compatible table columns, constraints and RLS.
- Compatible `public.profiles`, Supabase Auth and Storage; `storage.objects`
  must have RLS enabled and `owner_id` of type `text`, and
  `storage.foldername(text)` must exist. The privacy patch also requires RLS
  on listings and authenticated SELECT on both listings and Storage objects.
- A working admin authorization chain. The local `market_is_admin()` first
  calls `public.is_admin()` if present; otherwise it checks `admin_users` if
  present. Verify the *actual* definitions and an admin account; do not assume
  an admin check succeeds just because a function exists.
- The reviewed listing policy permits **all authenticated accounts** to see
  available and sold listings. It does not verify enrollment or restrict
  listings by college. Profile RLS may hide a seller's name from other users.
- CampusCommunity and its friendships are needed only for the Market contact
  button, not for the two Market patches.

The earlier report that the bucket was missing is unverified. Its actual
existence, settings and objects must be checked; do not assume it is absent.

## Read-only inspection

First verify the exact project and get authorization to inspect it. Use the
Supabase SQL Editor's read-only `SELECT` statements below, one block at a time.
They query metadata and the target bucket's configuration, not listing contents
or Storage object names. They do not apply a migration or create test data.
Do not share credentials, access tokens, signed URLs, or personal information.
If any query fails, any required object is missing, or anything differs from
the reviewed definitions, **stop** and request a separate plan. Do not drop,
replace, or edit existing objects to make a patch succeed.

### 1. Identify prerequisites

```sql
SELECT current_database() AS database_name,
       current_user AS inspection_role,
       current_setting('server_version') AS postgres_version;

SELECT to_regclass('public.profiles') AS profiles,
       to_regclass('public.admin_users') AS admin_users,
       to_regclass('public.market_listings') AS market_listings,
       to_regclass('public.market_listing_reports') AS market_listing_reports,
       to_regclass('storage.buckets') AS storage_buckets,
       to_regclass('storage.objects') AS storage_objects,
       to_regprocedure('public.is_admin()') AS is_admin,
       to_regprocedure('public.market_is_admin()') AS market_is_admin,
       to_regprocedure('storage.foldername(text)') AS storage_foldername,
       to_regprocedure('public.market_image_has_visible_listing(text)') AS privacy_helper;
```

If Storage or either Market base table is missing, stop; the completion patch
does not install the Market base. If the privacy helper already exists, do not
rerun the privacy patch; inspect its definition and all six privacy policies.

### 2. Inspect bucket settings and RLS

Run the bucket query only if `storage.buckets` exists:

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'campus-market' OR name = 'campus-market';
```

The expected bucket has both ID and name `campus-market`, `public = false`,
`file_size_limit = 5242880`, and exactly `image/jpeg`, `image/png`,
`image/webp`, `image/gif`. If absent, note that fact; completion can create it
only if every other prerequisite passes and the owner later approves execution.
If an existing bucket differs, **stop**. Completion's `ON CONFLICT` would
otherwise change its configuration.

```sql
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
       pg_get_userbyid(c.relowner) AS owner, c.relacl AS explicit_acl,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS authenticated_delete,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname = 'public' AND c.relname IN
       ('profiles', 'admin_users', 'market_listings', 'market_listing_reports'))
   OR (n.nspname = 'storage' AND c.relname IN ('objects', 'buckets'))
ORDER BY n.nspname, c.relname;

SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE a.attnum > 0 AND NOT a.attisdropped
  AND ((n.nspname = 'storage' AND c.relname IN ('objects', 'buckets'))
    OR (n.nspname = 'public' AND c.relname IN ('profiles', 'admin_users',
        'market_listings', 'market_listing_reports')))
ORDER BY n.nspname, c.relname, a.attnum;
```

Compare all relevant columns, types, RLS flags and effective grants to the
local scripts. In particular, listings/reports should be authenticated
SELECT-only for clients, and the `images` column must be `text[]`. Storage
table-level grants alone do not prove access: inspect every applicable policy.
Privileged roles and table owners may bypass RLS.

### 3. Inspect policies, constraints and functions

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE (schemaname = 'storage' AND tablename = 'objects')
   OR (schemaname = 'public' AND tablename IN
       ('profiles', 'admin_users', 'market_listings', 'market_listing_reports'))
ORDER BY schemaname, tablename, policyname;

SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname,
       pg_catalog.pg_get_constraintdef(con.oid) AS definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('market_listings', 'market_listing_reports')
ORDER BY c.relname, con.conname;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('market_listings', 'market_listing_reports')
ORDER BY tablename, indexname;

SELECT c.relname AS table_name, t.tgname AS trigger_name,
       pg_catalog.pg_get_triggerdef(t.oid) AS definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND c.relname IN ('market_listings', 'market_listing_reports')
ORDER BY c.relname, t.tgname;

SELECT n.nspname AS schema_name, p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS argument_types,
       pg_catalog.pg_get_function_arguments(p.oid) AS arguments_and_defaults,
       pg_catalog.pg_get_function_result(p.oid) AS result_type,
       pg_catalog.pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer, p.proconfig AS configuration,
       p.proacl AS explicit_acl,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND (p.proname LIKE 'market\_%' ESCAPE '\' OR p.proname = 'is_admin')
ORDER BY p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid);
```

Compare complete policy roles, commands, expressions, checks and
permissive/restrictive flags, including **other** applicable Storage policies.
Completion checks the eight policy names it manages against its own templates;
it does not prove all other policies safe. Privacy deliberately adds a
permissive visible-image read and restrictive guards that intersect completion's
guards. Other restrictive policies can still deny intended operations. This
compatibility is a static assessment, not a PostgreSQL/Storage test.

Compare the function bodies, return types, owner, `SECURITY DEFINER`/`INVOKER`,
search paths and effective grants, not just their names. The local UI calls:

| Function | Named arguments | Local return |
| --- | --- | --- |
| `market_create_listing` | `p_title`, `p_description`, `p_price`, `p_category`, `p_condition`, `p_images`, `p_contact_preference` | UUID |
| `market_update_listing` | `p_listing_id`, then the seven create arguments | boolean |
| `market_toggle_status` | `p_listing_id`, `p_status` | text |
| `market_delete_listing` | `p_listing_id` | boolean |
| `market_report_listing` | `p_listing_id`, `p_reason` | UUID |
| `market_admin_review_report` | `p_report_id`, `p_status` | boolean |

The reviewed base already defines the admin-review RPC. Completion replaces
that function unconditionally with its stricter local version; it does not
preflight the old function body or all existing grants. If its definition,
ownership, signature, or grants are unexpected, **do not run completion**.
Likewise, stop for unknown overloads or unexpected default privileges.

Important data-loss caveat: in the reviewed base, the reports' `listing_id`
foreign key is `ON DELETE CASCADE`. Deleting a listing deletes its reports.
Check the actual constraint and agree on a separate evidence-retention plan if
this is unacceptable. Do not delete existing listings or reports as a test.

## Conditional installation, only after separate approval

Before any installation, validate the scripts on an approved isolated,
compatible test fixture without rerunning the Market base, take an appropriate
backup, arrange a maintenance window, and review the read-only results with the
owner. Do not execute either patch against live Supabase until explicitly
approved. Each file contains its own `BEGIN` and `COMMIT`.

1. If completion's bucket, policies and admin-review function are absent or
   still match the reviewed base and all checks above pass, the candidate
   completion file is `database/migration_campus_market_completion.sql`. If
   already installed and all definitions are verified, do not rerun it merely
   to be safe. If its existing objects differ, stop.
2. If the full completion state is verified and no privacy helper or named
   privacy policy exists, the candidate next file is
   `database/migration_campus_market_image_privacy.sql`. This patch intentionally
   fails if any of its helper/policy names already exist. If a complete matching
   privacy setup is already installed, do not rerun it. If partial, different
   or unknown, stop.
3. Only after approval, in the verified target's SQL Editor, run the complete
   text of the required completion file first. Confirm success and inspect its
   resulting definitions. Then run the complete text of the privacy file if
   required. Do not paste only fragments, force past a preflight error, or run
   the Market base. Record exact errors and stop on the first failure.
4. Completion alone allows any authenticated account to sign any Market
   upload, including orphans. Avoid an exposed interval between patches; if
   privacy fails, stop and report the temporarily broader access rather than
   making unapproved corrective changes.

These patches are required only if the verified database lacks their equivalent
features and the reviewed patch is compatible. Their source cannot establish
whether they are required on a particular project.

## Verification after separately approved test-data operations

Use a disposable isolated project with compatible prerequisites and separate
authenticated accounts A and B, plus an admin and an anonymous session. This
checklist is **not yet run**. Do not use real accounts, existing listings, or
existing objects as disposable test data.

1. A uploads JPEG, PNG, WebP and GIF, including a file of exactly 5 MiB, and
   creates a listing. Over-5-MiB and unsupported-MIME uploads must fail. MIME
   checks are not proof of file contents.
2. B sees A's available listing and its freshly signed image. Test sold listings
   too: the local listing policy makes them visible. Confirm B cannot edit or
   change its status, upload into A's folder, or update/delete A's object.
3. A edits details and image associations, marks sold and reopens the listing.
   Separately verify A can update/delete an A-owned Storage object through the
   Storage API, using only explicitly disposable objects. The current Market
   form removes an image *association* on save; it does not delete the object.
   Cancelling, removing an image, a failed upload, or deleting a listing can
   leave unreferenced Storage objects. Do not clean them up without approval.
4. B reports A's listing; a non-admin cannot review reports; the admin sees and
   reviews or dismisses it. Listing deletion cascades reports in the reviewed
   base, so test deletion only with separate approval and disposable data.
5. An unauthenticated request cannot create a new signed URL or read an object
   without a bearer token. B cannot sign A's unlisted object; A can sign their
   own unlisted object; an admin can inspect it. Check another bucket is
   unaffected. Verify broad existing permissive policies cannot bypass the
   Market restrictive guards.
6. A signed URL is a bearer link: anyone possessing it can use it until its
   expiry, including after sign-out or a later RLS change. Test an expired URL
   separately. The UI requests one-hour URLs and refreshes before expiry; it
   refuses stored external or already-signed URLs rather than reusing them.
   Existing legacy URLs are not migrated or deleted.

Record actual HTTP/RPC errors and verify effective ACLs and RLS with real
sessions. Local Node tests use mocks and static source checks; they do not prove
PostgreSQL syntax, policies, Storage owner assignment, or signed-URL behavior.
