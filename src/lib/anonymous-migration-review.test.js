// Static source checks only: these do not run PostgreSQL, RLS, or Realtime.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const base = read('database/migration_campus_anonymous.sql')
const active = read('database/migration_anonymous_active_participants.sql')
const legacy = read('database/migration_anonymous_chat.sql')
const page = read('src/pages/Anonymous.jsx')
const frontend = [
  page,
  read('src/lib/anonymousWebrtc.js'),
  read('src/lib/anonymousSession.js'),
  read('src/components/AnonymousModeration.jsx'),
].join('\n')

test('[static] separate room-column indexes cannot enforce cross-column uniqueness', () => {
  // With A < B < C, both per-column indexes accept these rooms even though B
  // occurs twice. The participant table's single primary key must reject B.
  const rooms = [['A', 'B'], ['B', 'C']]
  assert.equal(new Set(rooms.map(([first]) => first)).size, rooms.length)
  assert.equal(new Set(rooms.map(([, second]) => second)).size, rooms.length)
  assert.notEqual(new Set(rooms.flat()).size, rooms.length * 2)
  assert.match(base, /CREATE UNIQUE INDEX anonymous_rooms_one_active_per_user_1/)
  assert.match(base, /CREATE UNIQUE INDEX anonymous_rooms_one_active_per_user_2/)
  assert.match(active, /user_id UUID PRIMARY KEY REFERENCES public\.profiles/)
  assert.match(active, /VALUES \(NEW\.user_1\), \(NEW\.user_2\)/)
  assert.match(active, /ORDER BY participant\.user_id/)
  assert.match(active, /LOCK TABLE public\.anonymous_rooms IN SHARE ROW EXCLUSIVE MODE/)
  assert.match(active, /GROUP BY participants\.user_id HAVING pg_catalog\.count\(\*\) > 1/)
  assert.match(active, /AFTER INSERT OR UPDATE ON public\.anonymous_rooms/)
  assert.match(active, /OLD\.status = 'active' AND NEW\.status = 'ended'/)
  assert.match(active, /DELETE FROM public\.anonymous_active_participants WHERE room_id = NEW\.id/)
  assert.match(active, /OLD\.status = 'ended' AND NEW\.status = 'active'/)
})

test('[static] the participant patch checks effective access and serialized entry', () => {
  assert.match(active, /has_table_privilege\(v_role::name, 'public\.anonymous_active_participants'/)
  assert.match(active, /has_any_column_privilege\(v_role::name, 'public\.anonymous_active_participants'/)
  assert.match(active, /FOREACH v_role IN ARRAY ARRAY\['anon', 'authenticated', 'service_role'\]/)
  assert.match(active, /'public\.anonymous_join_or_match_unlocked_v1\(\)'/)
  assert.match(active, /has_function_privilege\(v_role::name, v_signature, 'EXECUTE'\)/)
  assert.match(active, /has_function_privilege\('anon', 'public\.anonymous_join_or_match\(\)', 'EXECUTE'\)/)
  assert.match(active, /has_function_privilege\('service_role', 'public\.anonymous_join_or_match\(\)', 'EXECUTE'\)/)
  assert.match(active, /NOT pg_catalog\.has_function_privilege\('authenticated', 'public\.anonymous_join_or_match\(\)', 'EXECUTE'\)/)
  assert.match(active, /pg_advisory_xact_lock\(1129136973, 1\)/)
  assert.match(active, /RETURN public\.anonymous_join_or_match_unlocked_v1\(\)/)
})

test('[static] join, check, leave, block and report share one lock before touching room state', () => {
  for (const name of ['anonymous_join_or_match', 'anonymous_check_match', 'anonymous_leave', 'anonymous_block_partner', 'anonymous_report_partner']) {
    const fn = active.match(new RegExp(`CREATE FUNCTION public\\.${name}\\b[\\s\\S]*?\\n\\$\\$;`))?.[0]
    assert.ok(fn, `missing ${name}`)
    assert.match(fn, /SECURITY DEFINER\s+SET search_path = ''/)
    assert.match(fn, /current_setting\('transaction_isolation'\) <> 'read committed'/)
    assert.match(fn, /pg_advisory_xact_lock\(1129136973, 1\)/)
    assert.ok(fn.indexOf('pg_advisory_xact_lock') < fn.indexOf('public.anonymous_', fn.indexOf('BEGIN')))
  }
  const block = active.match(/CREATE FUNCTION public\.anonymous_block_partner\b[\s\S]*?\n\$\$;/)?.[0]
  const report = active.match(/CREATE FUNCTION public\.anonymous_report_partner\b[\s\S]*?\n\$\$;/)?.[0]
  assert.match(block, /anonymous_block_partner_unlocked_v1\(p_room_id\)[\s\S]*anonymous_end_blocked_pair\(p_room_id\)/)
  assert.match(report, /anonymous_report_partner_unlocked_v1\(p_room_id, p_reason, p_snippet\)[\s\S]*anonymous_end_blocked_pair\(p_room_id\)/)
  const cleanup = active.match(/CREATE FUNCTION public\.anonymous_end_blocked_pair\b[\s\S]*?\n\$\$;/)?.[0]
  assert.match(cleanup, /previous\.user_1 = auth\.uid\(\) OR previous\.user_2 = auth\.uid\(\)/)
  assert.match(cleanup, /r\.user_1 = previous\.user_1 AND r\.user_2 = previous\.user_2/)
  assert.match(cleanup, /FROM public\.anonymous_blocks/)
  assert.doesNotMatch(cleanup, /DELETE FROM public\.anonymous_messages|DELETE FROM public\.anonymous_reports/i)
  const leave = active.match(/CREATE FUNCTION public\.anonymous_leave\b[\s\S]*?\n\$\$;/)?.[0]
  assert.match(leave, /IF p_room_id IS NULL THEN[\s\S]*anonymous_leave_unlocked_v1\(NULL\)/)
  assert.doesNotMatch(leave, /DELETE FROM public\.anonymous_queue/i)
  const oldCheck = base.match(/CREATE FUNCTION public\.anonymous_check_match\b[\s\S]*?\n\$\$;/)?.[0]
  const check = active.match(/CREATE FUNCTION public\.anonymous_check_match\b[\s\S]*?\n\$\$;/)?.[0]
  assert.match(oldCheck, /DELETE FROM public\.anonymous_queue WHERE user_id = v_uid/)
  assert.match(check, /pg_advisory_xact_lock\(1129136973, 1\)[\s\S]*anonymous_check_match_unlocked_v1\(\)/)
})

test('[static] the patch rejects missing message INSERT publication and sensitive table publication', () => {
  assert.match(active, /pubname = 'supabase_realtime' AND NOT puballtables AND pubinsert/)
  assert.match(active, /pg_catalog\.pg_publication_tables/)
  assert.match(active, /tablename = 'anonymous_messages'/)
  for (const table of ['anonymous_rooms', 'anonymous_queue', 'anonymous_blocks',
    'anonymous_reports', 'anonymous_rate_limits', 'anonymous_video_sessions', 'anonymous_signals']) {
    assert.ok(active.includes(`'${table}'`), `missing publication check for ${table}`)
  }
  assert.match(active, /without publishing sensitive Anonymous tables/)
  assert.doesNotMatch(active, /ALTER PUBLICATION|DELETE FROM public\.anonymous_messages/i)
})

test('[static] restored history and moderation responses check their originating generation and room', () => {
  assert.match(page, /if \(!isMounted \|\| !sessionGuard\.isCurrent\(roomToken\) \|\| roomRef\.current !== data\.room_id\) return prev/)
  const block = page.slice(page.indexOf('const handleBlockPartner'), page.indexOf('\n  }', page.indexOf('const handleBlockPartner')))
  assert.match(block, /if \(!sessionGuard\.isCurrent\(token\) \|\| roomRef\.current !== targetRoom\) return/)
  const report = page.slice(page.indexOf('const handleSubmitReport'), page.indexOf('\n  }', page.indexOf('const handleSubmitReport')))
  assert.match(report, /intentRef\.current === intent &&\s+roomRef\.current === targetRoom && sessionGuard\.isCurrent\(sessionGuard\.current\(\)\)/)
  assert.match(report, /if \(!isCurrentReport\(\)\) return/)
  assert.match(report, /if \(isCurrentReport\(\)\) \{[\s\S]*reportPendingRef\.current = false[\s\S]*setSubmittingReport\(false\)/)
  assert.match(report, /if \(!supabase \|\| !roomId \|\| stopRequestRef\.current \|\| reportPendingRef\.current\) return/)
})

test('[static] all Anonymous frontend RPC arguments match local SQL signatures', () => {
  const calls = [...frontend.matchAll(/\.rpc\('((?:anonymous_)[a-z_]+)'(?:,\s*\{([\s\S]*?)\})?\)/g)]
  assert.ok(calls.length >= 15, `only found ${calls.length} frontend RPC calls`)
  for (const [, name, args = ''] of calls) {
    const signature = base.match(
      new RegExp(`CREATE FUNCTION public\\.${name}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS`, 'i')
    )?.[1]
    assert.notEqual(signature, undefined, `missing SQL function ${name}`)
    const declared = [...signature.matchAll(/\b(p_[a-z_]+)\s+(?:UUID|TEXT|JSONB|BIGINT)/gi)].map((item) => item[1])
    const passed = [...args.matchAll(/\b(p_[a-z_]+)\s*:/g)].map((item) => item[1])
    for (const arg of passed) assert.ok(declared.includes(arg), `${name} does not declare ${arg}`)
    for (const arg of declared) {
      if (new RegExp(`\\b${arg}\\s+[^,]+\\s+DEFAULT\\b`, 'i').test(signature)) continue
      assert.ok(passed.includes(arg), `${name} requires ${arg}`)
    }
  }
  assert.doesNotMatch(frontend, /\.rpc\('(match_anonymous_user|leave_anonymous_chat)'/)
  assert.match(legacy, /'partner_id', v_partner_id/)
  assert.match(legacy, /DELETE FROM public\.anonymous_messages WHERE room_id = p_room_id/)
})
