-- =============================================================
-- SUPERSEDED — DO NOT EXECUTE
-- This patch has been consolidated into the canonical first-install migration:
--   database/migration_campus_anonymous_canonical.sql
-- Retained for historical audit reference only.
-- =============================================================
-- CampusAnonymous: enforce one active room per student across BOTH columns.
-- Apply once only after the reviewed CampusAnonymous migration is installed.
-- This migration does not end rooms, remove messages, or change report evidence.
BEGIN;

DO $$
DECLARE
  v_spec RECORD;
  v_proc REGPROCEDURE;
BEGIN
  IF pg_catalog.to_regclass('public.anonymous_rooms') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_messages') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_blocks') IS NULL
     OR pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_join_or_match()') IS NULL THEN
    RAISE EXCEPTION 'The CampusAnonymous rooms, messages, blocks, profiles and matchmaking RPC are required.';
  END IF;
  -- Schema-wide publications can include sensitive tables even when
  -- puballtables is false. Text chat also requires INSERT publication.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime' AND NOT puballtables AND pubinsert
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'anonymous_messages'
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'anonymous_queue', 'anonymous_rooms', 'anonymous_blocks',
        'anonymous_reports', 'anonymous_rate_limits',
        'anonymous_video_sessions', 'anonymous_signals'
      ])
  ) THEN
    RAISE EXCEPTION 'Realtime must publish anonymous message inserts without publishing sensitive Anonymous tables; inspect the publication.';
  END IF;
  IF pg_catalog.to_regclass('public.anonymous_active_participants') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.anonymous_sync_active_participants()') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.anonymous_join_or_match_unlocked_v1()') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_trigger
       WHERE tgrelid = 'public.anonymous_rooms'::regclass
         AND tgname = 'anonymous_sync_active_participants' AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'Active-participant objects already exist; inspect the installation rather than rerunning.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = 'public.anonymous_join_or_match()'::regprocedure
      AND p.prorettype = 'jsonb'::regtype AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']
      AND pg_catalog.pg_has_role(p.proowner, 'USAGE')
  ) THEN
    RAISE EXCEPTION 'The existing matchmaking RPC must have the expected secure signature/configuration and an accessible owner.';
  END IF;
  -- The new wrappers must see and update every room regardless of caller RLS.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_roles r ON r.rolname = current_user
    WHERE c.oid = 'public.anonymous_rooms'::regclass
      AND (r.rolsuper OR r.rolbypassrls OR (r.oid = c.relowner AND NOT c.relforcerowsecurity))
  ) OR NOT pg_catalog.has_table_privilege(current_user, 'public.anonymous_rooms', 'SELECT')
    OR NOT pg_catalog.has_table_privilege(current_user, 'public.anonymous_rooms', 'UPDATE') THEN
    RAISE EXCEPTION 'The installing role must be able to inspect and update all Anonymous rooms despite RLS.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_roles r ON r.rolname = current_user
    WHERE c.oid = 'public.anonymous_blocks'::regclass
      AND (r.rolsuper OR r.rolbypassrls OR (r.oid = c.relowner AND NOT c.relforcerowsecurity))
  ) OR NOT pg_catalog.has_table_privilege(current_user, 'public.anonymous_blocks', 'SELECT') THEN
    RAISE EXCEPTION 'The installing role must be able to inspect all Anonymous blocks despite RLS.';
  END IF;
  -- The older migration uses these SAME table names. Its match RPC bypasses
  -- the wrapper and its leave RPC deletes messages. Never overwrite or remove
  -- them automatically; the installation needs a separately reviewed plan.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('match_anonymous_user', 'leave_anonymous_chat')
  ) THEN
    RAISE EXCEPTION 'Legacy anonymous matchmaking or leave RPC exists; inspect the shared tables and evidence before proceeding.';
  END IF;
  -- Renaming a function with dependants can preserve a reference to its OID
  -- and bypass the wrapper. Source scanning also catches ordinary alternate
  -- room-inserting RPCs; dynamic SQL and privileged direct writers still
  -- require a separate manual audit.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_depend d
    WHERE d.refclassid = 'pg_catalog.pg_proc'::regclass
      AND d.refobjid = 'public.anonymous_join_or_match()'::regprocedure
      AND d.deptype IN ('n', 'a')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND p.oid <> 'public.anonymous_join_or_match()'::regprocedure
      AND (
        p.prosrc ~* 'insert[[:space:]]+into[[:space:]]+(("public"|public)[.])?"?anonymous_rooms"?'
        OR p.prosrc ~* '\manonymous_join_or_match_unlocked_v1\M'
      )
  ) THEN
    RAISE EXCEPTION 'A dependent or alternate anonymous matchmaking entry point exists; inspect locking before proceeding.';
  END IF;
  -- Do not silently revoke unknown custom roles when making the old
  -- implementation private.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) a
    WHERE p.oid = 'public.anonymous_join_or_match()'::regprocedure
      AND a.privilege_type = 'EXECUTE' AND a.grantee <> p.proowner
      AND a.grantee <> 0
      AND a.grantee NOT IN ('anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
  ) THEN
    RAISE EXCEPTION 'Unexpected matchmaking EXECUTE grants exist; inspect them before proceeding.';
  END IF;
  -- These existing RPCs will also be wrapped. Reject incompatible signatures,
  -- dependencies and unexpected grants rather than silently changing them.
  FOR v_spec IN
    SELECT * FROM (VALUES
      ('public.anonymous_check_match()', 'jsonb'),
      ('public.anonymous_leave(uuid)', 'boolean'),
      ('public.anonymous_block_partner(uuid)', 'boolean'),
      ('public.anonymous_report_partner(uuid,text,text)', 'uuid')
    ) AS expected(signature, result_type)
  LOOP
    v_proc := pg_catalog.to_regprocedure(v_spec.signature);
    IF v_proc IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc p
      WHERE p.oid = v_proc AND p.prorettype = pg_catalog.to_regtype(v_spec.result_type)
        AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
        AND pg_catalog.pg_has_role(p.proowner, 'USAGE')
    ) THEN
      RAISE EXCEPTION 'Expected secure Anonymous RPC % is missing or incompatible.', v_spec.signature;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_depend d
      WHERE d.refclassid = 'pg_catalog.pg_proc'::regclass
        AND d.refobjid = v_proc AND d.deptype IN ('n', 'a')
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) a
      WHERE p.oid = v_proc AND a.privilege_type = 'EXECUTE'
        AND a.grantee <> p.proowner AND a.grantee <> 0
        AND a.grantee NOT IN ('anon'::regrole::oid, 'authenticated'::regrole::oid, 'service_role'::regrole::oid)
    ) THEN
      RAISE EXCEPTION 'Unexpected dependencies or grants on %; inspect before proceeding.', v_spec.signature;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'anonymous_check_match_unlocked_v1', 'anonymous_leave_unlocked_v1', 'anonymous_block_partner_unlocked_v1',
      'anonymous_report_partner_unlocked_v1', 'anonymous_end_blocked_pair'
    ])
  ) THEN
    RAISE EXCEPTION 'Anonymous lock-wrapper objects already exist; inspect rather than replacing them.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND p.oid NOT IN (
        'public.anonymous_check_match()'::regprocedure,
        'public.anonymous_leave(uuid)'::regprocedure,
        'public.anonymous_block_partner(uuid)'::regprocedure,
        'public.anonymous_report_partner(uuid,text,text)'::regprocedure
      )
      AND p.prosrc ~* '\manonymous_(check_match|leave|block_partner|report_partner)(_unlocked_v1)?[[:space:]]*\('
  ) THEN
    RAISE EXCEPTION 'Another function calls an Anonymous room-exit RPC; inspect dependencies and locking before proceeding.';
  END IF;
END;
$$;

-- Block concurrent room writes during the duplicate check, backfill, and
-- trigger installation. Existing history and evidence remain unchanged.
LOCK TABLE public.anonymous_rooms IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT participants.user_id
    FROM (
      SELECT user_1 AS user_id FROM public.anonymous_rooms WHERE status = 'active'
      UNION ALL
      SELECT user_2 AS user_id FROM public.anonymous_rooms WHERE status = 'active'
    ) participants
    GROUP BY participants.user_id HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A student already appears in multiple active rooms; inspect and resolve manually before installing.';
  END IF;
END;
$$;

CREATE TABLE public.anonymous_active_participants (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.anonymous_rooms(id) ON DELETE CASCADE
);
CREATE INDEX anonymous_active_participants_room_idx
  ON public.anonymous_active_participants (room_id);
ALTER TABLE public.anonymous_active_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.anonymous_active_participants FROM PUBLIC, anon, authenticated;

-- Explicit revokes do not remove privileges inherited through another role.
-- Client writes to this table could invalidate the cross-column guarantee.
DO $$
DECLARE v_role TEXT;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF pg_catalog.has_table_privilege(v_role::name, 'public.anonymous_active_participants',
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR pg_catalog.has_any_column_privilege(v_role::name, 'public.anonymous_active_participants',
         'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'Unexpected active-participant privileges for %; inspect inherited grants and ownership.', v_role;
    END IF;
  END LOOP;
END;
$$;

-- Both rows are inserted in UUID order in the room transaction. A conflict
-- aborts the entire room insertion, including the other participant's row.
-- Ended rooms release both rows in the same transaction. Room identities and
-- ended-to-active transitions are immutable; a new match needs a new room.
CREATE FUNCTION public.anonymous_sync_active_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_RELID <> 'public.anonymous_rooms'::regclass THEN
    RAISE EXCEPTION 'Invalid active-participant trigger relation.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_1 IS DISTINCT FROM OLD.user_1
       OR NEW.user_2 IS DISTINCT FROM OLD.user_2 THEN
      RAISE EXCEPTION 'Anonymous room identity and participants cannot be changed.';
    END IF;
    IF OLD.status = 'ended' AND NEW.status = 'active' THEN
      RAISE EXCEPTION 'An ended anonymous room cannot be reopened.';
    END IF;
    IF OLD.status = 'active' AND NEW.status = 'ended' THEN
      DELETE FROM public.anonymous_active_participants WHERE room_id = NEW.id;
    END IF;
  ELSIF NEW.status = 'active' THEN
    INSERT INTO public.anonymous_active_participants (user_id, room_id)
    SELECT participant.user_id, NEW.id
    FROM (VALUES (NEW.user_1), (NEW.user_2)) AS participant(user_id)
    ORDER BY participant.user_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.anonymous_sync_active_participants() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER anonymous_sync_active_participants
AFTER INSERT OR UPDATE ON public.anonymous_rooms
FOR EACH ROW EXECUTE FUNCTION public.anonymous_sync_active_participants();

INSERT INTO public.anonymous_active_participants (user_id, room_id)
SELECT participant.user_id, participant.room_id
FROM (
  SELECT user_1 AS user_id, id AS room_id FROM public.anonymous_rooms WHERE status = 'active'
  UNION ALL
  SELECT user_2 AS user_id, id AS room_id FROM public.anonymous_rooms WHERE status = 'active'
) participant
ORDER BY participant.user_id;

-- All join/check/leave/block/report entry points take the same lock first. The
-- original functions remain private, so none can invert that order.
ALTER FUNCTION public.anonymous_join_or_match() RENAME TO anonymous_join_or_match_unlocked_v1;
ALTER FUNCTION public.anonymous_check_match() RENAME TO anonymous_check_match_unlocked_v1;
ALTER FUNCTION public.anonymous_leave(UUID) RENAME TO anonymous_leave_unlocked_v1;
ALTER FUNCTION public.anonymous_block_partner(UUID) RENAME TO anonymous_block_partner_unlocked_v1;
ALTER FUNCTION public.anonymous_report_partner(UUID, TEXT, TEXT) RENAME TO anonymous_report_partner_unlocked_v1;
REVOKE ALL ON FUNCTION public.anonymous_join_or_match_unlocked_v1()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.anonymous_check_match_unlocked_v1()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.anonymous_leave_unlocked_v1(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.anonymous_block_partner_unlocked_v1(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.anonymous_report_partner_unlocked_v1(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

-- Fail closed if a client can still execute the original function through
-- inherited privileges or ownership; that would bypass the serialized entry.
DO $$
DECLARE
  v_role TEXT;
  v_signature TEXT;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.anonymous_join_or_match_unlocked_v1()',
    'public.anonymous_check_match_unlocked_v1()',
    'public.anonymous_leave_unlocked_v1(uuid)',
    'public.anonymous_block_partner_unlocked_v1(uuid)',
    'public.anonymous_report_partner_unlocked_v1(uuid,text,text)'
  ] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF pg_catalog.has_function_privilege(v_role::name, v_signature, 'EXECUTE') THEN
        RAISE EXCEPTION 'Unexpected unlocked RPC EXECUTE privilege for % on %; inspect inherited grants and ownership.', v_role, v_signature;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Must be called only while holding the shared lock, after the original
-- block/report has authenticated the caller and recorded the block.
CREATE FUNCTION public.anonymous_end_blocked_pair(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.anonymous_rooms r
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = auth.uid()
  FROM public.anonymous_rooms previous
  WHERE previous.id = p_room_id
    AND (previous.user_1 = auth.uid() OR previous.user_2 = auth.uid())
    AND r.status = 'active'
    AND r.user_1 = previous.user_1 AND r.user_2 = previous.user_2
    AND EXISTS (
      SELECT 1 FROM public.anonymous_blocks b
      WHERE (b.blocker_id = previous.user_1 AND b.blocked_id = previous.user_2)
         OR (b.blocker_id = previous.user_2 AND b.blocked_id = previous.user_1)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_end_blocked_pair(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.anonymous_join_or_match()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous matchmaking requires READ COMMITTED isolation.';
  END IF;
  -- Two-integer advisory-lock namespace shared by Anonymous session mutations.
  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);
  RETURN public.anonymous_join_or_match_unlocked_v1();
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_join_or_match() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_join_or_match() TO authenticated;

CREATE FUNCTION public.anonymous_check_match()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous match checks require READ COMMITTED isolation.';
  END IF;
  -- The original check deletes a queue row after finding a room. Serialize it
  -- so an old check cannot delete a newer search's queue entry.
  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);
  RETURN public.anonymous_check_match_unlocked_v1();
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_check_match() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_check_match() TO authenticated;

CREATE FUNCTION public.anonymous_leave(p_room_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous leave requires READ COMMITTED isolation.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);
  IF p_room_id IS NULL THEN
    RETURN public.anonymous_leave_unlocked_v1(NULL);
  END IF;
  -- A delayed leave for an old room must not cancel a newer queue entry.
  UPDATE public.anonymous_rooms
  SET status = 'ended', ended_at = pg_catalog.now(), ended_by = auth.uid()
  WHERE id = p_room_id AND status = 'active'
    AND (user_1 = auth.uid() OR user_2 = auth.uid());
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_leave(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_leave(UUID) TO authenticated;

CREATE FUNCTION public.anonymous_block_partner(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous blocking requires READ COMMITTED isolation.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);
  v_result := public.anonymous_block_partner_unlocked_v1(p_room_id);
  IF v_result IS TRUE THEN PERFORM public.anonymous_end_blocked_pair(p_room_id); END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_block_partner(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_block_partner(UUID) TO authenticated;

CREATE FUNCTION public.anonymous_report_partner(
  p_room_id UUID, p_reason TEXT, p_snippet TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_report_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous reporting requires READ COMMITTED isolation.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);
  v_report_id := public.anonymous_report_partner_unlocked_v1(p_room_id, p_reason, p_snippet);
  PERFORM public.anonymous_end_blocked_pair(p_room_id);
  RETURN v_report_id;
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_report_partner(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_report_partner(UUID, TEXT, TEXT) TO authenticated;

DO $$
DECLARE v_signature TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) a
    WHERE p.oid = 'public.anonymous_join_or_match()'::regprocedure
      AND a.privilege_type = 'EXECUTE' AND a.grantee <> p.proowner
      AND a.grantee <> 'authenticated'::regrole::oid
  ) THEN
    RAISE EXCEPTION 'Unexpected default EXECUTE grants on matchmaking wrapper; inspect default privileges.';
  END IF;
  IF pg_catalog.has_function_privilege('anon', 'public.anonymous_join_or_match()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('service_role', 'public.anonymous_join_or_match()', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', 'public.anonymous_join_or_match()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected effective EXECUTE privileges on matchmaking wrapper; inspect inherited grants and ownership.';
  END IF;
  FOREACH v_signature IN ARRAY ARRAY[
    'public.anonymous_check_match()', 'public.anonymous_leave(uuid)', 'public.anonymous_block_partner(uuid)',
    'public.anonymous_report_partner(uuid,text,text)'
  ] LOOP
    IF pg_catalog.has_function_privilege('anon', v_signature, 'EXECUTE')
       OR pg_catalog.has_function_privilege('service_role', v_signature, 'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('authenticated', v_signature, 'EXECUTE')
       OR EXISTS (
         SELECT 1 FROM pg_catalog.pg_proc p
         CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
         WHERE p.oid = pg_catalog.to_regprocedure(v_signature)
           AND a.privilege_type = 'EXECUTE' AND a.grantee <> p.proowner
           AND a.grantee <> 'authenticated'::regrole::oid
       ) THEN
      RAISE EXCEPTION 'Unexpected EXECUTE privileges on Anonymous wrapper %.', v_signature;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    WHERE p.oid = 'public.anonymous_end_blocked_pair(uuid)'::regprocedure
      AND a.privilege_type = 'EXECUTE' AND a.grantee <> p.proowner
  ) OR pg_catalog.has_function_privilege('anon', 'public.anonymous_end_blocked_pair(uuid)', 'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated', 'public.anonymous_end_blocked_pair(uuid)', 'EXECUTE')
    OR pg_catalog.has_function_privilege('service_role', 'public.anonymous_end_blocked_pair(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected EXECUTE privileges on Anonymous pair cleanup helper.';
  END IF;
END;
$$;

COMMIT;
