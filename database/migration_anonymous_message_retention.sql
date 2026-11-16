-- CampusAnonymous message-retention mechanism.
-- PROPOSAL: 30 days after room end and 90 days after the LAST report is
-- resolved. These are configurable placeholders, not legal requirements.
-- Cleanup is DISABLED by default. Installing this migration deletes no data.
BEGIN;

DO $$
DECLARE
  v_proc REGPROCEDURE;
  v_column TEXT;
  v_table TEXT;
  v_role TEXT;
BEGIN
  IF pg_catalog.to_regclass('public.anonymous_rooms') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_reports') IS NULL
     OR pg_catalog.to_regclass('public.anonymous_messages') IS NULL
     OR pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regprocedure('public.is_admin()') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_leave(uuid)') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_block_partner(uuid)') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_report_partner(uuid,text,text)') IS NULL
     OR pg_catalog.to_regprocedure('public.anonymous_admin_review_report(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'The reviewed CampusAnonymous and administrator infrastructure is required.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('match_anonymous_user', 'leave_anonymous_chat')
  ) THEN
    RAISE EXCEPTION 'Legacy anonymous RPCs exist; inspect their shared-table writes and evidence deletion before proceeding.';
  END IF;
  IF pg_catalog.to_regclass('public.anonymous_retention_config') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.anonymous_retention_report_guard()') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.anonymous_admin_cleanup_messages(integer)') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_attribute
       WHERE ((attrelid = 'public.anonymous_rooms'::regclass AND attname = 'evidence_purged_at')
           OR (attrelid = 'public.anonymous_reports'::regclass AND attname = 'resolved_at'))
         AND attnum > 0 AND NOT attisdropped
     )
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_trigger
       WHERE tgrelid = 'public.anonymous_reports'::regclass
         AND tgname = 'anonymous_retention_report_guard' AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'Retention objects already exist; inspect rather than rerunning.';
  END IF;
  FOREACH v_table IN ARRAY ARRAY[
    'public.anonymous_rooms', 'public.anonymous_reports', 'public.anonymous_messages'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class
      WHERE oid = pg_catalog.to_regclass(v_table) AND relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is required on %.', v_table;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF pg_catalog.has_table_privilege(v_role, v_table, 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
         OR pg_catalog.has_any_column_privilege(v_role, v_table, 'INSERT,UPDATE') THEN
        RAISE EXCEPTION 'Direct client writes are granted on % to %.', v_table, v_role;
      END IF;
    END LOOP;
  END LOOP;
  -- Verify the reviewed evidence-preserving RPCs are present. This simple
  -- check is not a substitute for reviewing arbitrary dynamic SQL or grants.
  FOREACH v_proc IN ARRAY ARRAY[
    'public.anonymous_leave(uuid)'::regprocedure,
    'public.anonymous_block_partner(uuid)'::regprocedure,
    'public.anonymous_report_partner(uuid,text,text)'::regprocedure,
    'public.anonymous_admin_review_report(uuid,text)'::regprocedure
  ] LOOP
    IF pg_catalog.pg_get_functiondef(v_proc) ~* 'delete[[:space:]]+from[[:space:]]+(public[.])?anonymous_messages' THEN
      RAISE EXCEPTION 'An existing CampusAnonymous RPC deletes messages; inspect it before installing retention.';
    END IF;
  END LOOP;
  -- Reports must prevent room/profile cascades from silently deleting holds.
  FOREACH v_column IN ARRAY ARRAY['room_id', 'reporter_id', 'reported_id'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid = c.conrelid AND a.attname = v_column
      WHERE c.conrelid = 'public.anonymous_reports'::regclass
        AND c.contype = 'f' AND c.confdeltype = 'r' AND c.convalidated AND a.attnotnull
        AND c.conkey = ARRAY[a.attnum]::smallint[]
        AND c.confrelid = CASE WHEN v_column = 'room_id'
          THEN 'public.anonymous_rooms'::regclass ELSE 'public.profiles'::regclass END
    ) THEN
      RAISE EXCEPTION 'Report % requires the reviewed NOT NULL / ON DELETE RESTRICT foreign key.', v_column;
    END IF;
  END LOOP;
END;
$$;

-- Prevent a report or room update from slipping between column creation and
-- guard-trigger installation. No existing rows are updated or deleted.
LOCK TABLE public.anonymous_rooms IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.anonymous_reports IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.anonymous_rooms ADD COLUMN evidence_purged_at TIMESTAMPTZ;
ALTER TABLE public.anonymous_reports ADD COLUMN resolved_at TIMESTAMPTZ;

CREATE TABLE public.anonymous_retention_config (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  unreported_days INTEGER NOT NULL DEFAULT 30 CHECK (unreported_days BETWEEN 1 AND 3650),
  resolved_days INTEGER NOT NULL DEFAULT 90 CHECK (resolved_days BETWEEN 1 AND 3650),
  cleanup_enabled BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO public.anonymous_retention_config (singleton) VALUES (TRUE);
ALTER TABLE public.anonymous_retention_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.anonymous_retention_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.anonymous_retention_config TO authenticated;
CREATE POLICY anonymous_retention_config_admin_select
  ON public.anonymous_retention_config FOR SELECT TO authenticated
  USING (public.is_admin());

-- All report inserts and updates synchronize on the room row, including
-- moderation. A late report after a completed purge is rejected rather than
-- creating a pending report whose transcript has already been destroyed.
CREATE FUNCTION public.anonymous_retention_report_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purged_at TIMESTAMPTZ;
BEGIN
  IF TG_RELID <> 'public.anonymous_reports'::regclass THEN
    RAISE EXCEPTION 'Invalid retention report trigger relation.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.room_id IS DISTINCT FROM OLD.room_id THEN
      RAISE EXCEPTION 'A report cannot be moved to another room.';
    END IF;
  END IF;
  SELECT r.evidence_purged_at INTO v_purged_at
  FROM public.anonymous_rooms r WHERE r.id = NEW.room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report room not found.'; END IF;
  IF v_purged_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.status = 'pending') THEN
    RAISE EXCEPTION 'The reporting period has expired and this transcript was purged.';
  END IF;

  IF NEW.status = 'pending' THEN
    NEW.resolved_at := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.resolved_at := pg_catalog.clock_timestamp();
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.resolved_at := pg_catalog.clock_timestamp();
  ELSE
    NEW.resolved_at := OLD.resolved_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.anonymous_retention_report_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER anonymous_retention_report_guard
BEFORE INSERT OR UPDATE ON public.anonymous_reports
FOR EACH ROW EXECUTE FUNCTION public.anonymous_retention_report_guard();

-- Manual, explicitly enabled, bounded cleanup. No scheduler is installed.
-- Existing resolved reports have NULL resolved_at and are conservatively held.
CREATE FUNCTION public.anonymous_admin_cleanup_messages(p_batch_size INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_config RECORD;
  v_room RECORD;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_deleted INTEGER;
  v_rooms INTEGER := 0;
  v_messages INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator access required.';
  END IF;
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 500 THEN
    RAISE EXCEPTION 'Cleanup batch size must be between 1 and 500.';
  END IF;
  -- The post-lock report recheck must see reports committed after the
  -- candidate query's snapshot. Do not silently run under a fixed snapshot.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Anonymous cleanup requires READ COMMITTED isolation.';
  END IF;
  SELECT * INTO v_config FROM public.anonymous_retention_config
  WHERE singleton IS TRUE FOR SHARE;
  IF NOT FOUND OR v_config.cleanup_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Anonymous message cleanup is disabled.';
  END IF;

  FOR v_room IN
    SELECT r.id FROM public.anonymous_rooms r
    WHERE r.status = 'ended' AND r.ended_at IS NOT NULL
      AND r.evidence_purged_at IS NULL
      AND r.ended_at <= v_now - pg_catalog.make_interval(days => v_config.unreported_days)
      AND NOT EXISTS (
        SELECT 1 FROM public.anonymous_reports rp
        WHERE rp.room_id = r.id AND (
          rp.status = 'pending' OR rp.resolved_at IS NULL
          OR rp.resolved_at > v_now - pg_catalog.make_interval(days => v_config.resolved_days)
        )
      )
    ORDER BY r.ended_at, r.id
    LIMIT p_batch_size
    FOR UPDATE OF r SKIP LOCKED
  LOOP
    -- Recheck AFTER taking the room lock. A report committed between the
    -- initial candidate snapshot and this lock must prevent deletion.
    IF EXISTS (
      SELECT 1 FROM public.anonymous_reports rp
      WHERE rp.room_id = v_room.id AND (
        rp.status = 'pending' OR rp.resolved_at IS NULL
        OR rp.resolved_at > v_now - pg_catalog.make_interval(days => v_config.resolved_days)
      )
    ) THEN
      CONTINUE;
    END IF;
    DELETE FROM public.anonymous_messages WHERE room_id = v_room.id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    UPDATE public.anonymous_rooms
    SET evidence_purged_at = pg_catalog.clock_timestamp()
    WHERE id = v_room.id;
    v_rooms := v_rooms + 1;
    v_messages := v_messages + v_deleted;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('rooms_processed', v_rooms, 'messages_deleted', v_messages);
END;
$$;
REVOKE ALL ON FUNCTION public.anonymous_admin_cleanup_messages(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymous_admin_cleanup_messages(INTEGER) TO authenticated;

COMMIT;
