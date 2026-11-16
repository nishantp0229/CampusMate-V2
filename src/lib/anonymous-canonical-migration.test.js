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

test('[canonical] realtime preflight rejects all-tables publication, requires pubinsert, and rejects sensitive tables', () => {
  assert.match(canonical, /pubname = 'supabase_realtime' AND NOT puballtables AND pubinsert/)
  for (const table of [
    'anonymous_queue', 'anonymous_rooms', 'anonymous_blocks',
    'anonymous_reports', 'anonymous_rate_limits', 'anonymous_video_sessions',
    'anonymous_signals', 'anonymous_active_participants'
  ]) {
    assert.ok(canonical.includes(`'${table}'`), `missing publication check for ${table}`)
  }
  assert.match(canonical, /Realtime must not publish sensitive Anonymous tables/)
  assert.match(canonical, /Realtime must publish anonymous message inserts without publishing sensitive Anonymous tables/)
})

