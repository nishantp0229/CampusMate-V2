// Static migration contracts and in-memory concurrency models only.
// These tests do not execute SQL or model PostgreSQL transaction isolation.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name) => readFileSync(new URL(`../../database/${name}`, import.meta.url), 'utf8')
const activeSql = read('migration_anonymous_active_participants.sql')
const marketSql = read('migration_campus_market_image_privacy.sql')
const marketBase = read('migration_campus_market.sql')
const retentionSql = read('migration_anonymous_message_retention.sql')
const signalSql = read('migration_anonymous_signal_expiry.sql')
const anonymousBase = read('migration_campus_anonymous.sql')
const legacySql = read('migration_anonymous_chat.sql')

const functionDef = (sql, name) => {
  const fn = sql.match(new RegExp(`CREATE FUNCTION public\\.${name}\\b[\\s\\S]*?\\n\\$\\$;`))?.[0]
  assert.ok(fn, `missing function ${name}`)
  return fn
}

test('[static] both room positions are protected by one unique participant key', () => {
  assert.match(activeSql, /user_id UUID PRIMARY KEY REFERENCES public\.profiles/)
  assert.match(activeSql, /LOCK TABLE public\.anonymous_rooms IN SHARE ROW EXCLUSIVE MODE/)
  assert.match(activeSql, /SELECT user_1 AS user_id[\s\S]*?UNION ALL[\s\S]*?SELECT user_2 AS user_id/)
  assert.match(activeSql, /GROUP BY participants\.user_id HAVING pg_catalog\.count\(\*\) > 1/)
  const sync = functionDef(activeSql, 'anonymous_sync_active_participants')
  assert.match(sync, /TG_RELID <> 'public\.anonymous_rooms'::regclass/)
  assert.match(sync, /VALUES \(NEW\.user_1\), \(NEW\.user_2\)/)
  assert.match(sync, /ORDER BY participant\.user_id/)
  assert.match(sync, /OLD\.status = 'active' AND NEW\.status = 'ended'/)
  assert.match(sync, /DELETE FROM public\.anonymous_active_participants WHERE room_id = NEW\.id/)
  assert.match(sync, /ended anonymous room cannot be reopened/)
  assert.match(sync, /participants cannot be changed/)
  assert.match(sync, /NEW\.id IS DISTINCT FROM OLD\.id/)
  assert.match(activeSql, /AFTER INSERT OR UPDATE ON public\.anonymous_rooms/)
  assert.match(activeSql, /room_id UUID NOT NULL REFERENCES public\.anonymous_rooms\(id\) ON DELETE CASCADE/)
  assert.match(activeSql, /^BEGIN;[\s\S]*COMMIT;\s*$/m)
  assert.match(activeSql, /REVOKE ALL ON public\.anonymous_active_participants FROM PUBLIC, anon, authenticated/)
  assert.doesNotMatch(activeSql, /DELETE FROM public\.anonymous_messages|DROP TABLE/i)
})

test('[static] matchmaking entry point serializes joins without changing its return contract', () => {
  assert.match(activeSql, /ALTER FUNCTION public\.anonymous_join_or_match\(\) RENAME TO anonymous_join_or_match_unlocked_v1/)
  assert.match(activeSql, /REVOKE ALL ON FUNCTION public\.anonymous_join_or_match_unlocked_v1\(\)[\s\S]*?authenticated, service_role/)
  const wrapper = functionDef(activeSql, 'anonymous_join_or_match')
  assert.match(wrapper, /RETURNS JSONB/)
  assert.match(wrapper, /auth\.uid\(\) IS NULL/)
  assert.match(wrapper, /pg_catalog\.pg_advisory_xact_lock\(1129136973, 1\)/)
  assert.match(wrapper, /RETURN public\.anonymous_join_or_match_unlocked_v1\(\)/)
  assert.match(activeSql, /proname IN \('match_anonymous_user', 'leave_anonymous_chat'\)/)
  assert.match(activeSql, /pg_catalog\.pg_depend/)
  assert.match(activeSql, /alternate anonymous matchmaking entry point/)
  assert.match(legacySql, /CREATE OR REPLACE FUNCTION public\.match_anonymous_user\(\)/)
  assert.match(legacySql, /CREATE OR REPLACE FUNCTION public\.leave_anonymous_chat[\s\S]*?DELETE FROM public\.anonymous_messages/)
})

test('[static] private image access follows actual listing RLS and preserves other buckets', () => {
  const basePolicy = marketBase.match(/CREATE POLICY "market_listings_select"[\s\S]*?;/)?.[0] || ''
  assert.match(basePolicy, /TO authenticated\s+USING \(true\)/)
  const helper = functionDef(marketSql, 'market_image_has_visible_listing')
  assert.match(helper, /SECURITY INVOKER/)
  assert.match(helper, /FROM public\.market_listings l/)
  assert.match(helper, /l\.images @> ARRAY\[p_path\]::TEXT\[\]/)
  assert.match(marketSql, /AS RESTRICTIVE FOR SELECT TO PUBLIC/)
  assert.match(marketSql, /AS RESTRICTIVE FOR SELECT TO authenticated/)
  assert.match(marketSql, /bucket_id IS DISTINCT FROM 'campus-market'/)
  assert.match(marketSql, /owner_id = \(SELECT auth\.uid\(\)::text\)/)
  assert.match(marketSql, /storage\.foldername\(name\)/)
  assert.match(marketSql, /public\.market_is_admin\(\)/)
  assert.match(marketSql, /public\.market_image_has_visible_listing\(name\)/)
  assert.match(marketSql, /CREATE POLICY campus_market_allow_visible_read[\s\S]*?FOR SELECT TO authenticated/)
  const update = marketSql.match(/CREATE POLICY campus_market_guard_owned_update[\s\S]*?;/)?.[0] || ''
  assert.match(update, /AS RESTRICTIVE FOR UPDATE TO PUBLIC/)
  assert.match(update, /USING \([\s\S]*?owner_id = \(SELECT auth\.uid\(\)::text\)/)
  assert.match(update, /WITH CHECK \([\s\S]*?owner_id = \(SELECT auth\.uid\(\)::text\)/)
  const deletion = marketSql.match(/CREATE POLICY campus_market_guard_owned_delete[\s\S]*?;/)?.[0] || ''
  assert.match(deletion, /AS RESTRICTIVE FOR DELETE TO PUBLIC/)
  assert.match(deletion, /owner_id = \(SELECT auth\.uid\(\)::text\)/)
  assert.match(deletion, /storage\.foldername\(name\)/)
  assert.doesNotMatch(marketSql, /DROP POLICY|UPDATE storage\.buckets|DELETE FROM/i)
})

test('[static] retention is disabled by default, bounded, admin-only, and holds pending evidence', () => {
  assert.match(retentionSql, /unreported_days INTEGER NOT NULL DEFAULT 30/)
  assert.match(retentionSql, /resolved_days INTEGER NOT NULL DEFAULT 90/)
  assert.match(retentionSql, /cleanup_enabled BOOLEAN NOT NULL DEFAULT FALSE/)
  const cleanup = functionDef(retentionSql, 'anonymous_admin_cleanup_messages')
  assert.match(cleanup, /auth\.uid\(\) IS NULL OR public\.is_admin\(\) IS NOT TRUE/)
  assert.match(cleanup, /v_config\.cleanup_enabled IS NOT TRUE/)
  assert.match(cleanup, /p_batch_size < 1 OR p_batch_size > 500/)
  assert.match(cleanup, /current_setting\('transaction_isolation'\) <> 'read committed'/)
  assert.match(cleanup, /FOR UPDATE OF r SKIP LOCKED/)
  // Both candidate selection and the post-lock check must hold pending,
  // legacy NULL timestamps and recently resolved reports.
  assert.equal((cleanup.match(/rp\.status = 'pending' OR rp\.resolved_at IS NULL/g) || []).length, 2)
  assert.match(cleanup, /DELETE FROM public\.anonymous_messages WHERE room_id = v_room\.id/)
  assert.match(cleanup, /SET evidence_purged_at = pg_catalog\.clock_timestamp\(\)/)
  assert.doesNotMatch(retentionSql, /pg_cron|cron\.schedule|DROP TABLE/i)
})

test('[static] report creation and moderation synchronize with cleanup and reject post-purge reports', () => {
  const guard = functionDef(retentionSql, 'anonymous_retention_report_guard')
  assert.match(guard, /TG_RELID <> 'public\.anonymous_reports'::regclass/)
  assert.match(guard, /FROM public\.anonymous_rooms r WHERE r\.id = NEW\.room_id FOR UPDATE/)
  assert.match(guard, /v_purged_at IS NOT NULL AND \(TG_OP = 'INSERT' OR NEW\.status = 'pending'\)/)
  assert.match(guard, /NEW\.resolved_at := pg_catalog\.clock_timestamp\(\)/)
  assert.match(guard, /NEW\.resolved_at := OLD\.resolved_at/)
  assert.match(retentionSql, /BEFORE INSERT OR UPDATE ON public\.anonymous_reports/)
  assert.match(retentionSql, /confdeltype = 'r'/)
  assert.match(retentionSql, /INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER/)
  assert.match(retentionSql, /'match_anonymous_user', 'leave_anonymous_chat'/)
  assert.match(retentionSql, /LOCK TABLE public\.anonymous_rooms IN SHARE ROW EXCLUSIVE MODE/)
  assert.match(retentionSql, /LOCK TABLE public\.anonymous_reports IN SHARE ROW EXCLUSIVE MODE/)
  for (const sql of [activeSql, retentionSql]) {
    const definitions = sql.match(/CREATE FUNCTION public\.\w+[\s\S]*?\n\$\$;/g) || []
    for (const fn of definitions.filter((item) => item.includes('SECURITY DEFINER'))) {
      assert.match(fn, /SET search_path = ''/)
    }
  }
})

test('[static] signaling TTL uses an in-database job and never deletes report transcripts', () => {
  const setExpiry = functionDef(signalSql, 'anonymous_set_signal_expiry')
  assert.match(setExpiry, /TG_RELID <> 'public\.anonymous_signals'::regclass/)
  assert.match(setExpiry, /NEW\.expires_at := NEW\.created_at \+ INTERVAL '2 minutes'/)
  assert.match(signalSql, /UPDATE public\.anonymous_signals\s+SET expires_at = created_at \+ INTERVAL '2 minutes'/)
  assert.match(signalSql, /BEFORE INSERT OR UPDATE ON public\.anonymous_signals/)
  assert.match(signalSql, /to_regprocedure\('cron\.schedule\(text,text,text\)'\)/)
  assert.match(signalSql, /cron\.schedule\([\s\S]*?'\* \* \* \* \*'/)
  assert.match(signalSql, /REVOKE ALL ON FUNCTION public\.anonymous_cleanup_expired_signaling\(INTEGER\)[\s\S]*?PUBLIC, anon, authenticated, service_role/)
  assert.match(signalSql, /Unexpected cleanup EXECUTE privileges or owner-role membership/)
  assert.match(signalSql, /pg_catalog\.aclexplode/)
  assert.doesNotMatch(signalSql, /CREATE EXTENSION/i)
  assert.doesNotMatch(signalSql, /anonymous_admin_cleanup_messages/)
  const cleanup = functionDef(signalSql, 'anonymous_cleanup_expired_signaling')
  assert.match(cleanup, /current_setting\('transaction_isolation'\) <> 'read committed'/)
  assert.match(cleanup, /FOR UPDATE OF r SKIP LOCKED/)
  assert.match(cleanup, /DELETE FROM public\.anonymous_signals s/)
  assert.match(cleanup, /expired\.expires_at <= v_now/)
  assert.match(cleanup, /LIMIT 200/)
  assert.match(cleanup, /DELETE FROM public\.anonymous_video_sessions/)
  assert.match(cleanup, /vs\.status <> 'connected' OR v_room\.status = 'ended'/)
  assert.match(cleanup, /r\.status = 'active' AND r\.created_at < v_now - INTERVAL '2 hours'/)
  assert.match(cleanup, /SET status = 'ended', ended_at = v_now/)
  assert.doesNotMatch(cleanup, /DELETE FROM public\.anonymous_messages|DELETE FROM public\.anonymous_reports/i)
  const transcript = functionDef(anonymousBase, 'anonymous_admin_get_report_transcript')
  assert.match(transcript, /FROM public\.anonymous_messages m/)
  assert.doesNotMatch(transcript, /anonymous_signals|anonymous_video_sessions/)
  const poll = functionDef(anonymousBase, 'anonymous_poll_signals')
  assert.match(poll, /created_at > pg_catalog\.now\(\) - INTERVAL '2 minutes'/)
  assert.doesNotMatch(poll, /DELETE FROM public\.anonymous_signals/)
})

class Mutex {
  constructor() { this.tail = Promise.resolve() }
  async acquire() {
    const previous = this.tail
    let release
    const next = new Promise((resolve) => { release = resolve })
    this.tail = previous.then(() => next)
    await previous
    return release
  }
}

class MockActiveRooms {
  constructor() {
    this.locks = new Map()
    this.active = new Map()
    this.rooms = new Map()
    this.evidence = new Map()
  }

  async withParticipants(participants, operation) {
    const releases = []
    try {
      for (const user of [...participants].sort()) {
        if (!this.locks.has(user)) this.locks.set(user, new Mutex())
        releases.push(await this.locks.get(user).acquire())
      }
      return await operation()
    } finally {
      for (const release of releases.reverse()) release()
    }
  }

  async join(roomId, first, second) {
    return this.withParticipants([first, second], async () => {
      await Promise.resolve() // permit competing operations to interleave
      if (this.active.has(first) || this.active.has(second)) throw new Error('participant already active')
      this.active.set(first, roomId)
      this.active.set(second, roomId)
      this.rooms.set(roomId, [first, second])
      this.evidence.set(roomId, { messages: ['evidence'], pending: true })
      return roomId
    })
  }

  async end(roomId) {
    const users = this.rooms.get(roomId)
    return this.withParticipants(users, async () => {
      for (const user of users) if (this.active.get(user) === roomId) this.active.delete(user)
    })
  }
}

test('[mock model] opposite participant positions cannot both join; ending releases both atomically', async () => {
  const store = new MockActiveRooms()
  const attempts = await Promise.allSettled([
    store.join('room-ab', 'A', 'B'),
    store.join('room-ca', 'C', 'A'),
  ])
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(store.active.size, 2)
  const winner = attempts.find((result) => result.status === 'fulfilled').value
  const loser = winner === 'room-ab' ? 'room-ca' : 'room-ab'
  assert.ok([...store.active.values()].every((room) => room === winner))
  await store.end(winner)
  assert.equal(store.active.size, 0)
  assert.deepEqual(store.evidence.get(winner), { messages: ['evidence'], pending: true })
  if (loser === 'room-ca') await store.join(loser, 'C', 'A')
  else await store.join(loser, 'A', 'B')
  assert.equal(store.active.size, 2)
})

test('[mock model] a conflict on the second participant rolls back the first staged mapping', () => {
  const persisted = new Map([['Z', 'existing-room']])
  const transaction = new Map(persisted)
  assert.throws(() => {
    for (const user of ['A', 'Z'].sort()) {
      if (transaction.has(user)) throw new Error('unique participant conflict')
      transaction.set(user, 'new-room')
    }
  }, /unique participant conflict/)
  // A real database transaction would discard its staged writes on error.
  assert.equal(transaction.get('A'), 'new-room')
  assert.equal(persisted.has('A'), false)
  assert.equal(persisted.get('Z'), 'existing-room')
})

test('[mock model] leave, block, report and expiry release mappings without touching evidence', async () => {
  for (const cause of ['leave', 'block', 'report', 'expiry']) {
    const store = new MockActiveRooms()
    await store.join(`room-${cause}`, 'A', 'B')
    await store.end(`room-${cause}`)
    assert.equal(store.active.size, 0, cause)
    assert.deepEqual(store.evidence.get(`room-${cause}`), { messages: ['evidence'], pending: true })
  }
})

class MockRetention {
  constructor() {
    this.lock = new Mutex()
    this.messages = ['evidence']
    this.reports = []
    this.purged = false
  }
  async locked(operation) {
    const release = await this.lock.acquire()
    try { return await operation() } finally { release() }
  }
  async report() {
    return this.locked(async () => {
      if (this.purged) throw new Error('reporting period expired')
      this.reports.push({ status: 'pending', resolvedAt: null })
    })
  }
  async review() {
    return this.locked(async () => {
      this.reports[0].status = 'reviewed'
      this.reports[0].resolvedAt = 100
    })
  }
  async cleanup() {
    return this.locked(async () => {
      if (this.reports.some((report) => report.status === 'pending' ||
          report.resolvedAt === null || report.resolvedAt > 10)) return false
      this.messages = []
      this.purged = true
      return true
    })
  }
}

test('[mock model] report-versus-cleanup order never leaves a pending report without evidence', async () => {
  for (const cleanupFirst of [false, true]) {
    const store = new MockRetention()
    const actions = cleanupFirst ? [store.cleanup(), store.report()] : [store.report(), store.cleanup()]
    const results = await Promise.allSettled(actions)
    if (store.reports.some((report) => report.status === 'pending')) {
      assert.equal(results[0].status, 'fulfilled')
      assert.deepEqual(store.messages, ['evidence'])
      assert.equal(store.purged, false)
    } else {
      assert.equal(results[1].status, 'rejected')
      assert.equal(store.purged, true)
    }
  }
})

test('[mock model] review racing cleanup preserves pending or recently resolved evidence', async () => {
  for (const reviewFirst of [false, true]) {
    const store = new MockRetention()
    await store.report()
    const actions = reviewFirst ? [store.review(), store.cleanup()] : [store.cleanup(), store.review()]
    await Promise.all(actions)
    assert.deepEqual(store.messages, ['evidence'])
    assert.equal(store.purged, false)
  }
})

test('[mock model] resolving one of multiple reports never clears the other pending hold', async () => {
  const store = new MockRetention()
  await store.report()
  await store.report()
  await store.review()
  assert.equal(await store.cleanup(), false)
  assert.equal(store.reports.filter((report) => report.status === 'pending').length, 1)
  assert.deepEqual(store.messages, ['evidence'])
})

test('[mock model] expired signaling is removed without changing pending report evidence', () => {
  const room = {
    report: { status: 'pending', snippet: 'evidence' },
    messages: ['evidence'],
    signals: [{ expiresAt: 10 }, { expiresAt: 30 }],
  }
  room.signals = room.signals.filter((signal) => signal.expiresAt > 20)
  assert.deepEqual(room.signals, [{ expiresAt: 30 }])
  assert.deepEqual(room.report, { status: 'pending', snippet: 'evidence' })
  assert.deepEqual(room.messages, ['evidence'])
})

test('[mock model] restrictive Storage guards narrow even a broad permissive policy', () => {
  const canRead = ({ bucket = 'campus-market', authenticated = true, owner = false, admin = false, listed = false, broad = true }) =>
    bucket !== 'campus-market' ? broad : authenticated && (broad || owner || admin || listed) && (owner || admin || listed)
  const canWriteRow = ({ bucket = 'campus-market', authenticated = true, owner = false }) =>
    bucket !== 'campus-market' || (authenticated && owner)
  assert.equal(canRead({ listed: true }), true)
  assert.equal(canRead({ owner: true }), true)
  assert.equal(canRead({ admin: true }), true)
  assert.equal(canRead({}), false)
  assert.equal(canRead({ authenticated: false, listed: true }), false)
  assert.equal(canRead({ bucket: 'unrelated', broad: true }), true)
  assert.equal(canWriteRow({ owner: false }), false)
  assert.equal(canWriteRow({ owner: true }) && canWriteRow({ owner: false }), false) // UPDATE old/new
  assert.equal(canWriteRow({ bucket: 'unrelated' }), true)
})
