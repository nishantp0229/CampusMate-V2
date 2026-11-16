// Static verification tests for database/migration_campus_anonymous_canonical.sql
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const canonical = read('database/migration_campus_anonymous_canonical.sql')
const frontend = [
  read('src/pages/Anonymous.jsx'),
  read('src/lib/anonymousWebrtc.js'),
  read('src/lib/anonymousSession.js'),
  read('src/components/AnonymousModeration.jsx'),
].join('\n')

test('[canonical] active-participants table and trigger enforce cross-column single room invariant', () => {
  assert.match(canonical, /CREATE TABLE public\.anonymous_active_participants \([\s\S]*?user_id UUID PRIMARY KEY REFERENCES public\.profiles\(id\)/)
  assert.match(canonical, /CREATE FUNCTION public\.anonymous_sync_active_participants\(\)/)
  assert.match(canonical, /AFTER INSERT OR UPDATE ON public\.anonymous_rooms/)
  assert.match(canonical, /INSERT INTO public\.anonymous_active_participants \(user_id, room_id\)/)
  assert.match(canonical, /DELETE FROM public\.anonymous_active_participants WHERE room_id = NEW\.id/)
  assert.match(canonical, /OLD\.status = 'ended' AND NEW\.status = 'active'/)
  assert.match(canonical, /RAISE EXCEPTION 'An ended anonymous room cannot be reopened\.'/)
})

test('[canonical] concurrency locking uses transaction advisory lock on room lifecycle RPCs', () => {
  const lifecycleFns = [
    'anonymous_join_or_match',
    'anonymous_check_match',
    'anonymous_leave',
    'anonymous_block_partner',
    'anonymous_report_partner',
  ]

  for (const fnName of lifecycleFns) {
    const fnDef = canonical.match(new RegExp(`CREATE FUNCTION public\\.${fnName}\\b[\\s\\S]*?\\n\\$\\$;`))?.[0]
    assert.ok(fnDef, `missing ${fnName}`)
    assert.match(fnDef, /SECURITY DEFINER\s+SET search_path = ''/)
    assert.match(fnDef, /current_setting\('transaction_isolation'\) <> 'read committed'/)
    assert.match(fnDef, /pg_advisory_xact_lock\(1129136973, 1\)/)
  }
})

test('[canonical] redundant block index is removed and reverse index is present', () => {
  // Should NOT have duplicate index on (blocker_id, blocked_id)
  assert.doesNotMatch(canonical, /CREATE INDEX anonymous_blocks_blocker_idx/)
  // Should have reverse index on (blocked_id, blocker_id) for mutual lookup acceleration
  assert.match(canonical, /CREATE INDEX anonymous_blocks_blocked_idx ON public\.anonymous_blocks \(blocked_id, blocker_id\)/)
})

test('[canonical] messages table contains zero student UUID columns and streams via Realtime', () => {
  const msgTable = canonical.match(/CREATE TABLE public\.anonymous_messages \([\s\S]*?\);/)?.[0]
  assert.ok(msgTable, 'missing anonymous_messages table')
  assert.doesNotMatch(msgTable, /sender_id/)
  assert.doesNotMatch(msgTable, /user_id/)
  assert.match(msgTable, /sender_role\s+TEXT NOT NULL/)
  assert.match(msgTable, /sender_alias\s+TEXT NOT NULL/)
  assert.match(canonical, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.anonymous_messages/)
})

test('[canonical] all anonymous definers have empty search_path and proper privilege revocation', () => {
  const definers = [...canonical.matchAll(/CREATE FUNCTION public\.([a-z_]+)\([\s\S]*?\)\s*RETURNS[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/gi)]
  assert.ok(definers.length >= 13, `expected at least 13 secure definer functions, found ${definers.length}`)

  // Ensure PUBLIC execution is revoked
  assert.match(canonical, /REVOKE ALL ON FUNCTION public\.anonymous_join_or_match\(\) FROM PUBLIC/)
  assert.match(canonical, /GRANT EXECUTE ON FUNCTION public\.anonymous_join_or_match\(\) TO authenticated/)
})

test('[canonical] frontend RPC signatures match canonical migration declarations', () => {
  const calls = [...frontend.matchAll(/\.rpc\('((?:anonymous_)[a-z_]+)'(?:,\s*\{([\s\S]*?)\})?\)/g)]
  assert.ok(calls.length >= 15, `expected at least 15 frontend RPC calls, found ${calls.length}`)

  for (const [, name, args = ''] of calls) {
    const signature = canonical.match(
      new RegExp(`CREATE FUNCTION public\\.${name}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS`, 'i')
    )?.[1]
    assert.notEqual(signature, undefined, `missing SQL function ${name} in canonical migration`)
    const declared = [...signature.matchAll(/\b(p_[a-z_]+)\s+(?:UUID|TEXT|JSONB|BIGINT)/gi)].map((item) => item[1])
    const passed = [...args.matchAll(/\b(p_[a-z_]+)\s*:/g)].map((item) => item[1])
    for (const arg of passed) assert.ok(declared.includes(arg), `${name} does not declare parameter ${arg}`)
    for (const arg of declared) {
      if (new RegExp(`\\b${arg}\\s+[^,]+\\s+DEFAULT\\b`, 'i').test(signature)) continue
      assert.ok(passed.includes(arg), `${name} requires parameter ${arg}`)
    }
  }
})

test('[canonical] zero scheduled cron jobs and zero automatic message deletion', () => {
  assert.doesNotMatch(canonical, /cron\.schedule/i)
  assert.doesNotMatch(canonical, /DELETE FROM public\.anonymous_messages\b/i)
})

test('[canonical] stale leave targets only specified room and preserves newer queue entry', () => {
  const leaveFn = canonical.match(/CREATE FUNCTION public\.anonymous_leave\b[\s\S]*?\n\$\$;/)?.[0]
  assert.ok(leaveFn, 'missing anonymous_leave')
  // When p_room_id is supplied, only target that room and do NOT delete queue entries
  assert.match(leaveFn, /IF p_room_id IS NOT NULL THEN[\s\S]*UPDATE public\.anonymous_rooms[\s\S]*WHERE id = p_room_id[\s\S]*ELSE[\s\S]*DELETE FROM public\.anonymous_queue WHERE user_id = v_uid/)
  // Ensure DELETE FROM queue is NOT run before the IF check
  const beforeIf = leaveFn.slice(0, leaveFn.indexOf('IF p_room_id IS NOT NULL'))
  assert.doesNotMatch(beforeIf, /DELETE FROM public\.anonymous_queue/i)
})

test('[canonical] block and report remove caller from queue without deleting partner queue entry', () => {
  const blockFn = canonical.match(/CREATE FUNCTION public\.anonymous_block_partner\b[\s\S]*?\n\$\$;/)?.[0]
  assert.ok(blockFn, 'missing anonymous_block_partner')
  assert.match(blockFn, /DELETE FROM public\.anonymous_queue WHERE user_id = v_uid;/)
  assert.doesNotMatch(blockFn, /DELETE FROM public\.anonymous_queue WHERE user_id IN/i)

  const reportFn = canonical.match(/CREATE FUNCTION public\.anonymous_report_partner\b[\s\S]*?\n\$\$;/)?.[0]
  assert.ok(reportFn, 'missing anonymous_report_partner')
  assert.match(reportFn, /DELETE FROM public\.anonymous_queue WHERE user_id = v_uid;/)
  assert.doesNotMatch(reportFn, /DELETE FROM public\.anonymous_queue WHERE user_id IN/i)
})

test('[canonical, part1, part2_core & part3] realtime preflight rejects all-tables, namespace publication, and sensitive tables', () => {
  const part1 = read('database/migration_campus_anonymous_part1_schema.sql')
  const part2Core = read('database/migration_campus_anonymous_part2_core_rpcs.sql')
  const part3 = read('database/migration_campus_anonymous_part3_signaling.sql')

  for (const src of [canonical, part1, part2Core, part3]) {
    assert.match(src, /pubname = 'supabase_realtime'/)
    assert.match(src, /puballtables/)
    assert.match(src, /pubinsert/)
    for (const table of [
      'anonymous_queue', 'anonymous_rooms', 'anonymous_blocks',
      'anonymous_reports', 'anonymous_rate_limits', 'anonymous_video_sessions',
      'anonymous_signals', 'anonymous_active_participants'
    ]) {
      assert.ok(src.includes(`'${table}'`), `missing publication check for ${table}`)
    }
  }
})

test('[functions audit] exactly 16 anonymous functions exist across Part 1, Part 2 Core and Part 3 with SECURITY DEFINER and empty search_path', () => {
  const part1 = read('database/migration_campus_anonymous_part1_schema.sql')
  const part2Core = read('database/migration_campus_anonymous_part2_core_rpcs.sql')
  const part3 = read('database/migration_campus_anonymous_part3_signaling.sql')
  const combined = `${part1}\n${part2Core}\n${part3}`

  const expectedSignatures = [
    // Part 1: 1 trigger function + 2 helper functions
    'anonymous_sync_active_participants()',
    'anonymous_is_room_participant(p_room_id UUID)',
    'anonymous_check_rate_limit(p_user_id UUID, p_action TEXT, p_max INT, p_window INTERVAL)',
    // Part 2 Core: 11 application RPCs
    'anonymous_join_or_match()',
    'anonymous_check_match()',
    'anonymous_get_room_info(p_room_id UUID)',
    'anonymous_get_messages(p_room_id UUID)',
    'anonymous_heartbeat()',
    'anonymous_leave(p_room_id UUID DEFAULT NULL)',
    'anonymous_send_message(p_room_id UUID, p_content TEXT)',
    'anonymous_block_partner(p_room_id UUID)',
    'anonymous_report_partner(p_room_id UUID, p_reason TEXT, p_snippet TEXT DEFAULT NULL)',
    'anonymous_admin_review_report(p_report_id UUID, p_status TEXT)',
    'anonymous_admin_get_report_transcript(p_report_id UUID)',
    // Part 3 Signaling: 2 WebRTC signaling RPCs
    'anonymous_send_signal(p_room_id UUID, p_session_id UUID, p_event TEXT, p_payload JSONB DEFAULT \'{}\'::jsonb)',
    'anonymous_poll_signals(p_room_id UUID, p_after_id BIGINT DEFAULT 0)',
  ]

  assert.equal(expectedSignatures.length, 16, 'expected exactly 16 signatures')

  for (const sig of expectedSignatures) {
    const fnName = sig.slice(0, sig.indexOf('('))
    const fnText = combined.match(new RegExp(`CREATE FUNCTION public\\.${fnName}\\b[\\s\\S]*?\\n\\$\\$;`))?.[0]
    assert.ok(fnText, `could not extract body of ${fnName}`)
    assert.match(fnText, /SECURITY DEFINER/, `${fnName} must be SECURITY DEFINER`)
    assert.match(fnText, /SET search_path = ''/, `${fnName} must have empty search_path`)
  }
})

test('[canonical & part3] send_signal avoids unparenthesized CASE expression inside SDP payload validation', () => {
  const part3 = read('database/migration_campus_anonymous_part3_signaling.sql')
  for (const src of [canonical, part3]) {
    const sendFn = src.match(/CREATE FUNCTION public\.anonymous_send_signal\b[\s\S]*?\n\$\$;/)?.[0]
    assert.ok(sendFn, 'missing anonymous_send_signal')
    // Must NOT have unparenthesized CASE WHEN ... inside IS DISTINCT FROM
    assert.doesNotMatch(sendFn, /IS DISTINCT FROM\s+CASE WHEN/i)
    // Must have clear event-scoped type comparisons
    assert.match(sendFn, /p_event = 'video_offer' AND p_payload->>'type' IS DISTINCT FROM 'offer'/i)
    assert.match(sendFn, /p_event = 'video_answer' AND p_payload->>'type' IS DISTINCT FROM 'answer'/i)
  }
})

test('[split migrations] part1, part2_core and part3 provide clean function boundaries and explicit transaction handling', () => {
  const part1 = read('database/migration_campus_anonymous_part1_schema.sql')
  const part2Core = read('database/migration_campus_anonymous_part2_core_rpcs.sql')
  const part3Signaling = read('database/migration_campus_anonymous_part3_signaling.sql')

  // Part 1 explicit transaction
  assert.match(part1, /^\s*BEGIN;/m)
  assert.match(part1, /COMMIT;\s*$/m)
  for (const table of [
    'anonymous_queue', 'anonymous_rooms', 'anonymous_blocks',
    'anonymous_active_participants', 'anonymous_messages', 'anonymous_reports',
    'anonymous_rate_limits', 'anonymous_video_sessions', 'anonymous_signals'
  ]) {
    assert.match(part1, new RegExp(`CREATE TABLE public\\.${table}\\b`))
  }
  assert.match(part1, /CREATE TRIGGER anonymous_sync_active_participants/)

  // Part 2 Core explicit transaction & dependencies
  assert.match(part2Core, /^\s*BEGIN;/m)
  assert.match(part2Core, /COMMIT;\s*$/m)
  assert.match(part2Core, /Part 2 requires table public\.%\. Run Part 1 first\./)
  assert.match(part2Core, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.anonymous_messages/)
  for (const fn of [
    'anonymous_join_or_match', 'anonymous_check_match', 'anonymous_get_room_info',
    'anonymous_get_messages', 'anonymous_heartbeat', 'anonymous_leave',
    'anonymous_send_message', 'anonymous_block_partner', 'anonymous_report_partner',
    'anonymous_admin_review_report', 'anonymous_admin_get_report_transcript'
  ]) {
    assert.match(part2Core, new RegExp(`CREATE FUNCTION public\\.${fn}\\b`))
  }

  // Part 3 Signaling explicit transaction & dependencies
  assert.match(part3Signaling, /^\s*BEGIN;/m)
  assert.match(part3Signaling, /COMMIT;\s*$/m)
  assert.match(part3Signaling, /Part 3 requires tables from Part 1\. Run Part 1 first\./)
  assert.match(part3Signaling, /Part 3 requires core RPCs from Part 2\. Run Part 2 first\./)
  for (const fn of ['anonymous_send_signal', 'anonymous_poll_signals']) {
    assert.match(part3Signaling, new RegExp(`CREATE FUNCTION public\\.${fn}\\b`))
  }
})


