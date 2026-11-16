-- CampusAnonymous: enforce one active room per student across BOTH columns.
-- Apply once only after the reviewed CampusAnonymous migration is installed.
-- This migration does not end rooms, remove messages, or change report evidence.
BEGIN;

DO $$
BEGIN
  IF pg_catalog.to_regclass('public.anonymous_rooms') IS NULL
     OR pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_join_or_match()') IS NULL THEN
    RAISE EXCEPTION 'The CampusAnonymous rooms, profiles and matchmaking RPC are required.';
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

-- Serialize matchmaking calls before the existing implementation takes its
-- own user/queue locks. This avoids opposing join calls locking the two queue
-- rows in opposite orders. The original implementation and return JSON are
-- preserved; only its public entry point changes. All joins share one small
-- transaction-scoped lock, so throughput is intentionally bounded.
ALTER FUNCTION public.anonymous_join_or_match() RENAME TO anonymous_join_or_match_unlocked_v1;
REVOKE ALL ON FUNCTION public.anonymous_join_or_match_unlocked_v1()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.anonymous_join_or_match()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  -- Two-integer advisory-lock namespace, reserved for CampusAnonymous joins.
  PERFORM pg_catalog.pg_advisory_xact_lock(1129136973, 1);
  RETURN public.anonymous_join_or_match_unlocked_v1();
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_join_or_match() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anonymous_join_or_match() TO authenticated;

DO $$
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
END;
$$;

COMMIT;
