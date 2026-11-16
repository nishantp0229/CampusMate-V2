-- =============================================================
-- SUPERSEDED — DO NOT EXECUTE
-- The canonical first-install migration is:
--   database/migration_campus_anonymous_canonical.sql
-- In-database pg_cron scheduled jobs are disabled by zero-budget policy.
-- Retained for proposal/historical reference only.
-- =============================================================
-- CampusAnonymous: short-lived signaling metadata and in-database cleanup.
-- Requires the reviewed CampusAnonymous and active-participant migrations.
-- The in-database pg_cron extension must already be installed and operational;
-- no extension, paid service or external scheduler is installed here.
--
-- Installing this file activates a minute-by-minute cleanup job. It backfills
-- expires_at without deleting rows in the installation transaction. Once the
-- job runs it deletes expired signaling metadata; review and approve that
-- deletion separately before applying. Messages and reports are NEVER deleted
-- by this job. Signaling payloads are not part of the report transcript in
-- the reviewed schema and expire even when a report remains pending.
BEGIN;

DO $$
BEGIN
  IF pg_catalog.to_regclass('public.anonymous_rooms') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_reports') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_signals') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_video_sessions') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_active_participants') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_sync_active_participants()') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_send_signal(uuid,uuid,text,jsonb)') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_poll_signals(uuid,bigint)') IS NULL THEN
    RAISE EXCEPTION 'The reviewed CampusAnonymous and active-participant migrations are required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.anonymous_rooms'::regclass
      AND tgname = 'anonymous_sync_active_participants'
      AND tgfoid = 'public.anonymous_sync_active_participants()'::regprocedure
      AND tgenabled IN ('O', 'A') AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'The enabled room-participant trigger is required.';
  END IF;
  IF pg_catalog.to_regclass('cron.job') IS NULL
     OR pg_catalog.to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Operational in-database pg_cron is required; no external scheduler or extension is installed by this migration.';
  END IF;
  IF NOT pg_catalog.has_function_privilege(current_user, 'cron.schedule(text,text,text)', 'EXECUTE')
     OR NOT pg_catalog.has_table_privilege(current_user, 'cron.job', 'SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolcanlogin) THEN
    RAISE EXCEPTION 'The installing login role needs pg_cron schedule/inspection privileges.';
  END IF;
  IF pg_catalog.to_regprocedure('public.anonymous_set_signal_expiry()') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.anonymous_cleanup_expired_signaling(integer)') IS NOT NULL
     OR pg_catalog.to_regclass('public.anonymous_signals_room_expiry_idx') IS NOT NULL
     OR pg_catalog.to_regclass('public.anonymous_rooms_active_expiry_idx') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_attribute
       WHERE attrelid = 'public.anonymous_signals'::regclass
         AND attname = 'expires_at' AND attnum > 0 AND NOT attisdropped
     )
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_trigger
       WHERE tgrelid = 'public.anonymous_signals'::regclass
         AND tgname = 'anonymous_set_signal_expiry' AND NOT tgisinternal
     )
     OR EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'campusanonymous-signaling-expiry-v1') THEN
    RAISE EXCEPTION 'Signaling-expiry objects or job already exist; inspect rather than replacing them.';
  END IF;
END;
$$;

-- Backfill only the new metadata column. Existing signaling rows are not
-- deleted here. The TTL matches anonymous_poll_signals' two-minute window.
ALTER TABLE public.anonymous_signals ADD COLUMN expires_at TIMESTAMPTZ;
UPDATE public.anonymous_signals
SET expires_at = created_at + INTERVAL '2 minutes';
ALTER TABLE public.anonymous_signals ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX anonymous_signals_room_expiry_idx
  ON public.anonymous_signals (room_id, expires_at, id);
CREATE INDEX anonymous_rooms_active_expiry_idx
  ON public.anonymous_rooms (created_at, id) WHERE status = 'active';

-- Even a future trusted inserter cannot accidentally supply an unbounded TTL.
CREATE FUNCTION public.anonymous_set_signal_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_RELID <> 'public.anonymous_signals'::regclass THEN
    RAISE EXCEPTION 'Invalid signaling expiry trigger relation.';
  END IF;
  NEW.expires_at := NEW.created_at + INTERVAL '2 minutes';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_set_signal_expiry() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER anonymous_set_signal_expiry
BEFORE INSERT OR UPDATE ON public.anonymous_signals
FOR EACH ROW EXECUTE FUNCTION public.anonymous_set_signal_expiry();

-- Called by the in-database job owner only. The room lock serializes cleanup
-- with signaling operations. The report transcript and report rows are not
-- accessed or modified: only transient signaling state is deleted.
CREATE FUNCTION public.anonymous_cleanup_expired_signaling(p_batch_size INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_room RECORD;
  v_count INTEGER;
  v_rooms_ended INTEGER := 0;
  v_signals INTEGER := 0;
  v_sessions INTEGER := 0;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 500 THEN
    RAISE EXCEPTION 'Signaling cleanup batch size must be between 1 and 500 rooms.';
  END IF;
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Signaling cleanup requires READ COMMITTED isolation.';
  END IF;

  -- Enforce the existing two-hour room lifetime even when nobody joins again.
  -- The active-participant trigger releases both members transactionally.
  FOR v_room IN
    SELECT r.id FROM public.anonymous_rooms r
    WHERE r.status = 'active' AND r.created_at < v_now - INTERVAL '2 hours'
    ORDER BY r.created_at, r.id
    LIMIT p_batch_size FOR UPDATE OF r SKIP LOCKED
  LOOP
    UPDATE public.anonymous_rooms
    SET status = 'ended', ended_at = v_now
    WHERE id = v_room.id AND status = 'active';
    IF FOUND THEN v_rooms_ended := v_rooms_ended + 1; END IF;
  END LOOP;

  FOR v_room IN
    SELECT r.id, r.status FROM public.anonymous_rooms r
    WHERE (
      EXISTS (
        SELECT 1 FROM public.anonymous_signals s
        WHERE s.room_id = r.id AND s.expires_at <= v_now
      )
      OR EXISTS (
        SELECT 1 FROM public.anonymous_video_sessions vs
        WHERE vs.room_id = r.id AND vs.updated_at <= v_now - INTERVAL '2 minutes'
          AND (vs.status <> 'connected' OR r.status = 'ended')
      )
    )
    -- Prefer the oldest expired signal, rather than repeatedly servicing
    -- low UUIDs while other rooms' expired rows starve.
    ORDER BY COALESCE(
      (SELECT pg_catalog.min(s.expires_at) FROM public.anonymous_signals s
       WHERE s.room_id = r.id AND s.expires_at <= v_now),
      (SELECT vs.updated_at + INTERVAL '2 minutes' FROM public.anonymous_video_sessions vs
       WHERE vs.room_id = r.id AND vs.updated_at <= v_now - INTERVAL '2 minutes'
         AND (vs.status <> 'connected' OR r.status = 'ended')),
      'infinity'::timestamptz
    ), r.id
    LIMIT p_batch_size FOR UPDATE OF r SKIP LOCKED
  LOOP
    DELETE FROM public.anonymous_signals s
    WHERE s.id IN (
      SELECT expired.id FROM public.anonymous_signals expired
      WHERE expired.room_id = v_room.id AND expired.expires_at <= v_now
      ORDER BY expired.expires_at, expired.id LIMIT 200
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_signals := v_signals + v_count;

    -- A live connected call keeps its session. Abandoned handshakes, ended
    -- calls and sessions in ended rooms no longer need signaling state.
    DELETE FROM public.anonymous_video_sessions vs
    WHERE vs.room_id = v_room.id AND vs.updated_at <= v_now - INTERVAL '2 minutes'
      AND (vs.status <> 'connected' OR v_room.status = 'ended');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_sessions := v_sessions + v_count;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object(
    'rooms_ended', v_rooms_ended, 'signals_deleted', v_signals, 'sessions_deleted', v_sessions
  );
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_cleanup_expired_signaling(INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;

-- Default privileges can grant EXECUTE to additional roles. Do not leave an
-- unauthenticated SECURITY DEFINER cleanup callable by an unexpected role.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) a
    WHERE p.oid = 'public.anonymous_cleanup_expired_signaling(integer)'::regprocedure
      AND a.privilege_type = 'EXECUTE' AND a.grantee <> p.proowner
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = 'public.anonymous_cleanup_expired_signaling(integer)'::regprocedure
      AND (
        pg_catalog.pg_has_role('anon'::regrole::oid, p.proowner, 'USAGE')
        OR pg_catalog.pg_has_role('authenticated'::regrole::oid, p.proowner, 'USAGE')
        OR pg_catalog.pg_has_role('service_role'::regrole::oid, p.proowner, 'USAGE')
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected cleanup EXECUTE privileges or owner-role membership; inspect default privileges.';
  END IF;
END;
$$;

-- The job is registered as the current login role; it runs only this
-- narrowly scoped function. Registration is transactional with this file.
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT cron.schedule(
    'campusanonymous-signaling-expiry-v1',
    '* * * * *',
    'SELECT public.anonymous_cleanup_expired_signaling(50);'
  ) INTO v_jobid;
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobid = v_jobid AND database = pg_catalog.current_database() AND active IS TRUE
  ) THEN
    RAISE EXCEPTION 'The signaling cleanup job was not registered as active for this database.';
  END IF;
END;
$$;

COMMIT;
