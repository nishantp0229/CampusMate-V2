// src/lib/anonymous.test.js — Tests for CampusAnonymous domain logic & SQL migration contracts

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  validateAnonymousMessage,
  validateAnonymousReport,
  formatMessageTime,
  getIceServers,
  requestBrowserFullscreen,
  exitBrowserFullscreen,
} from './anonymous.js'

const migration = readFileSync(new URL('../../database/migration_campus_anonymous.sql', import.meta.url), 'utf8')

// ─── Domain Logic Tests ───────────────────────────────────────

test('validateAnonymousMessage validates bounds and trims content', () => {
  assert.equal(validateAnonymousMessage('Hello there!').isValid, true)
  assert.equal(validateAnonymousMessage('   Hello there!   ').content, 'Hello there!')

  // Empty or whitespace-only
  assert.equal(validateAnonymousMessage('').isValid, false)
  assert.equal(validateAnonymousMessage('    ').isValid, false)
  assert.match(validateAnonymousMessage('').error, /cannot be empty/)

  // Non-string
  assert.equal(validateAnonymousMessage(null).isValid, false)
  assert.equal(validateAnonymousMessage(123).isValid, false)

  // Max 1000 characters
  const longMsg = 'a'.repeat(1001)
  const result = validateAnonymousMessage(longMsg)
  assert.equal(result.isValid, false)
  assert.match(result.error, /cannot exceed 1000 characters/)
})

test('validateAnonymousReport validates reason length and snippet bounds', () => {
  const valid = validateAnonymousReport('Harassment or hate speech', 'Evidence snippet here')
  assert.equal(valid.isValid, true)
  assert.equal(valid.reason, 'Harassment or hate speech')
  assert.equal(valid.snippet, 'Evidence snippet here')

  // Short reason
  const shortReason = validateAnonymousReport('no')
  assert.equal(shortReason.isValid, false)
  assert.match(shortReason.error, /between 3 and 300 characters/)

  // Empty reason
  assert.equal(validateAnonymousReport('').isValid, false)
  assert.equal(validateAnonymousReport(null).isValid, false)

  // Long snippet is trimmed to 500 characters
  const longSnippet = 'x'.repeat(600)
  const trimmed = validateAnonymousReport('Valid reason here', longSnippet)
  assert.equal(trimmed.isValid, true)
  assert.equal(trimmed.snippet.length, 500)
})

test('formatMessageTime formats valid ISO timestamps safely', () => {
  assert.equal(formatMessageTime(null), '')
  assert.equal(formatMessageTime('invalid-date'), '')
  const formatted = formatMessageTime('2026-11-16T10:30:00Z')
  assert.ok(formatted.length > 0)
})

test('getIceServers provides 5 redundant default Google STUN servers and parses custom environment configuration', () => {
  const defaultServers = getIceServers()
  assert.ok(Array.isArray(defaultServers))
  assert.equal(defaultServers.length, 5)
  assert.equal(defaultServers[0].urls, 'stun:stun.l.google.com:19302')
  assert.equal(defaultServers[1].urls, 'stun:stun1.l.google.com:19302')
  assert.equal(defaultServers[2].urls, 'stun:stun2.l.google.com:19302')
  assert.equal(defaultServers[3].urls, 'stun:stun3.l.google.com:19302')
  assert.equal(defaultServers[4].urls, 'stun:stun4.l.google.com:19302')
})

test('requestBrowserFullscreen and exitBrowserFullscreen handle non-browser and browser environments without throwing', async () => {
  // In Node environment, typeof document === 'undefined'
  await assert.doesNotReject(async () => {
    await requestBrowserFullscreen()
  })
  await assert.doesNotReject(async () => {
    await exitBrowserFullscreen()
  })
})

// ─── Static SQL Migration Verification Tests ──────────────────

test('[Static SQL] preflight checks profiles, Phase A admin infrastructure, and prevents collisions', () => {
  // Profiles dependency
  assert.match(migration, /to_regclass\('public\.profiles'\) IS NULL/)
  assert.match(migration, /attname = 'id'/)

  // Phase A admin preflight (admin_users table and is_admin() function)
  assert.match(migration, /to_regclass\('public\.admin_users'\) IS NULL/)
  assert.match(migration, /to_regprocedure\('public\.is_admin\(\)'\) IS NULL/)

  // Realtime must use a table-specific publication.
  assert.match(migration, /pubname = 'supabase_realtime' AND NOT puballtables/)

  // Table collision detection
  assert.match(migration, /'anonymous_queue',/)
  assert.match(migration, /'anonymous_rooms',/)
  assert.match(migration, /'anonymous_messages',/)
  assert.match(migration, /'anonymous_blocks',/)
  assert.match(migration, /'anonymous_reports',/)
  assert.match(migration, /'anonymous_rate_limits',/)
  assert.match(migration, /Table public\.% already exists/)
  assert.match(migration, /'anonymous_join_or_match'/)
  assert.match(migration, /'anonymous_is_room_participant'/)
})

test('[Static SQL] tables, indexes, partial unique indexes and constraints are correct', () => {
  // All 6 tables (including rate limits)
  assert.match(migration, /CREATE TABLE public\.anonymous_queue/)
  assert.match(migration, /CREATE TABLE public\.anonymous_blocks/)
  assert.match(migration, /CREATE TABLE public\.anonymous_rooms/)
  assert.match(migration, /CREATE TABLE public\.anonymous_messages/)
  assert.match(migration, /CREATE TABLE public\.anonymous_reports/)
  assert.match(migration, /CREATE TABLE public\.anonymous_rate_limits/)

  // Canonical ordering constraint
  assert.match(migration, /CONSTRAINT anonymous_room_canonical_users\s+CHECK \(user_1 < user_2\)/)

  // Block self-check constraint
  assert.match(migration, /CONSTRAINT anonymous_no_self_block\s+CHECK \(blocker_id <> blocked_id\)/)

  // Trimming constraints
  assert.match(migration, /char_length\(pg_catalog\.btrim\(content\)\) > 0/)
  assert.match(migration, /char_length\(pg_catalog\.btrim\(reason\)\) >= 3/)

  // Zero bare trim() calls (strip comments first)
  const codeWithoutComments = migration.replace(/--.*$/gm, '')
  assert.equal(/(?<!b)trim\s*\(/.test(codeWithoutComments), false, 'No bare trim() calls permitted in migration')

  // Partial unique indexes enforcing one active room per user
  assert.match(migration, /CREATE UNIQUE INDEX anonymous_rooms_one_active_per_user_1/)
  assert.match(migration, /ON public\.anonymous_rooms \(user_1\)\s+WHERE \(?status = 'active'\)?/)
  assert.match(migration, /CREATE UNIQUE INDEX anonymous_rooms_one_active_per_user_2/)
  assert.match(migration, /ON public\.anonymous_rooms \(user_2\)\s+WHERE \(?status = 'active'\)?/)
})

test('[Static SQL] direct client writes revoked and direct SELECT revoked on sensitive tables', () => {
  // Revoke ALL on all 6 tables from PUBLIC, anon, authenticated
  assert.match(migration, /REVOKE ALL ON[\s\S]*?public\.anonymous_queue,[\s\S]*?public\.anonymous_rooms,[\s\S]*?public\.anonymous_messages[\s\S]*?FROM PUBLIC, anon, authenticated;/)

  // Report SELECT is column-limited; participant UUIDs are not granted.
  assert.match(migration, /GRANT SELECT ON\s+public\.anonymous_queue,\s+public\.anonymous_messages,\s+public\.anonymous_rate_limits\s+TO authenticated;/)
  assert.match(migration, /GRANT SELECT \(id, reason, snippet, status, created_at\)\s+ON public\.anonymous_reports TO authenticated;/)

  // Verify SELECT is NEVER granted on anonymous_rooms or anonymous_blocks (which contain participant UUIDs)
  const grantSelectBlock = migration.match(/GRANT SELECT ON[\s\S]*?TO authenticated;/)?.[0] || ''
  assert.equal(/anonymous_rooms/.test(grantSelectBlock), false, 'SELECT on anonymous_rooms must be REVOKED from clients')
  assert.equal(/anonymous_blocks/.test(grantSelectBlock), false, 'SELECT on anonymous_blocks must be REVOKED from clients')

  // Messages: participants of that room only (zero UUIDs exposed; required for postgres_changes)
  assert.match(migration, /CREATE POLICY anonymous_messages_participant_select/)

  // Reports: admin only (reporter UUID check removed to prevent partner UUID discovery)
  assert.match(migration, /CREATE POLICY anonymous_reports_admin_select/)
  assert.match(migration, /USING \(public\.is_admin\(\)\)/)

  // Rate limits: users see only their own rows
  assert.match(migration, /CREATE POLICY anonymous_rate_limits_own_select/)
  assert.match(migration, /user_id = \(SELECT auth\.uid\(\)\)/)
})

test('[Static SQL] all RPCs are SECURITY DEFINER with empty search_path and never leak partner_id', () => {
  const rpcs = [
    'anonymous_join_or_match',
    'anonymous_check_match',
    'anonymous_get_room_info',
    'anonymous_get_messages',
    'anonymous_heartbeat',
    'anonymous_leave',
    'anonymous_send_message',
    'anonymous_block_partner',
    'anonymous_report_partner',
    'anonymous_admin_review_report',
    'anonymous_admin_get_report_transcript',
  ]

  for (const rpc of rpcs) {
    const fnRegex = new RegExp(`CREATE FUNCTION public\\.${rpc}\\b[\\s\\S]*?\\n\\$\\$;`)
    const fnDef = migration.match(fnRegex)?.[0]
    assert.ok(fnDef, `Function public.${rpc} must exist in migration`)
    assert.match(fnDef, /SECURITY DEFINER/, `${rpc} must be SECURITY DEFINER`)
    assert.match(fnDef, /SET search_path = ''/, `${rpc} must set empty search_path`)

    // Verify revoked from PUBLIC and granted to authenticated
    const grantRegex = new RegExp(`GRANT\\s+EXECUTE ON FUNCTION public\\.${rpc}\\b.*?TO authenticated;`)
    assert.match(migration, grantRegex, `${rpc} must be granted to authenticated`)
    const revokeRegex = new RegExp(`REVOKE\\s+EXECUTE ON FUNCTION public\\.${rpc}\\b.*?FROM PUBLIC;`)
    assert.match(migration, revokeRegex, `${rpc} must revoke execute from PUBLIC`)
  }

  // CRITICAL PRIVACY CONTRACT: Matchmaking must NEVER return partner_id to client
  const matchFn = migration.match(/CREATE FUNCTION public\.anonymous_join_or_match\b[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.equal(/'partner_id'/.test(matchFn), false, 'Matchmaking must NEVER return partner_id to caller!')
  assert.match(matchFn, /FOR UPDATE OF q SKIP LOCKED/, 'Matchmaking must use FOR UPDATE SKIP LOCKED')
  assert.match(matchFn, /b\.blocker_id = v_uid\s+AND b\.blocked_id\s*=\s*q\.user_id/, 'Matchmaking must check mutual blocks')
})

test('[Static SQL] matchmaking has advisory lock, rate limit, and candidate active-room check', () => {
  const matchFn = migration.match(/CREATE FUNCTION public\.anonymous_join_or_match\b[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(matchFn, 'anonymous_join_or_match must exist')

  // Per-user advisory lock serializes concurrent requests
  assert.match(matchFn, /pg_advisory_xact_lock/, 'Matchmaking must use advisory lock for per-user serialization')

  // Rate limit enforced
  assert.match(matchFn, /anonymous_check_rate_limit/, 'Matchmaking must enforce rate limit')
  assert.match(matchFn, /'matchmaking'/, 'Matchmaking rate limit action name must be "matchmaking"')

  // Candidate must not already be in an active room
  assert.match(matchFn, /NOT EXISTS[\s\S]*?anonymous_rooms r[\s\S]*?status = 'active'/, 'Matchmaking must skip candidates already in active rooms')

  // Stale room pruning
  assert.match(matchFn, /INTERVAL '2 hours'/, 'Matchmaking must prune stale active rooms older than 2 hours')
})

test('[Static SQL] server-side rate limits are enforced in all sensitive RPCs', () => {
  // Rate limit table exists
  assert.match(migration, /CREATE TABLE public\.anonymous_rate_limits/)
  assert.match(migration, /user_id\s+UUID NOT NULL REFERENCES public\.profiles/)
  assert.match(migration, /window_start\s+TIMESTAMPTZ/)
  assert.match(migration, /PRIMARY KEY\s*\(user_id, action\)/)

  // Helper function exists and is NOT granted to clients
  assert.match(migration, /CREATE FUNCTION public\.anonymous_check_rate_limit/)
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION\s+public\.anonymous_check_rate_limit/)

  // anonymous_send_message enforces rate limit
  const sendFn = migration.match(/CREATE FUNCTION public\.anonymous_send_message\b[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(sendFn, /anonymous_check_rate_limit/, 'send_message must enforce rate limit')
  assert.match(sendFn, /'message'/, 'send_message rate limit action name must be "message"')

  // anonymous_heartbeat enforces rate limit
  const heartbeatFn = migration.match(/CREATE FUNCTION public\.anonymous_heartbeat\b[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(heartbeatFn, /anonymous_check_rate_limit/, 'heartbeat must enforce rate limit')

  // anonymous_report_partner enforces rate limit
  const reportFn = migration.match(/CREATE FUNCTION public\.anonymous_report_partner\b[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(reportFn, /anonymous_check_rate_limit/, 'report_partner must enforce rate limit')
  assert.match(reportFn, /'report'/, 'report rate limit action name must be "report"')
})

test('[Static SQL] message preservation during pending reports across leave, block and moderation', () => {
  // No operation deletes evidence, so leave/block/review winning a race with
  // a late report cannot remove the report's transcript.
  for (const name of ['anonymous_leave', 'anonymous_block_partner', 'anonymous_report_partner', 'anonymous_admin_review_report']) {
    const fn = migration.match(new RegExp(`CREATE FUNCTION public\\.${name}\\b[\\s\\S]*?\\n\\$\\$;`))?.[0] || ''
    assert.ok(fn, `${name} must exist`)
    assert.doesNotMatch(fn.replace(/--.*$/gm, ''), /DELETE FROM public\.anonymous_messages/i)
  }
  assert.doesNotMatch(migration.replace(/--.*$/gm, ''), /DELETE FROM public\.anonymous_messages/i)
  const reportFn = migration.match(/CREATE FUNCTION public\.anonymous_report_partner\b[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(reportFn, /INSERT INTO public\.anonymous_reports[\s\S]*?'pending'/)
  assert.match(migration, /room_id\s+UUID NOT NULL REFERENCES public\.anonymous_rooms\(id\) ON DELETE RESTRICT/)
  assert.match(migration, /reporter_id UUID NOT NULL REFERENCES public\.profiles\(id\) ON DELETE RESTRICT/)
})

test('[Static SQL] Realtime publication excludes sensitive tables and signaling uses RPCs', () => {
  // anonymous_rooms is excluded from supabase_realtime to prevent user_1/user_2 leaking
  assert.equal(
    /ALTER PUBLICATION supabase_realtime ADD TABLE public\.anonymous_rooms/.test(migration),
    false,
    'anonymous_rooms must NOT be in supabase_realtime (leaks user_1/user_2 in WAL payloads)'
  )

  // anonymous_messages is added to supabase_realtime because it has zero user UUID columns
  assert.match(
    migration,
    /ALTER PUBLICATION supabase_realtime ADD TABLE public\.anonymous_messages;/,
    'anonymous_messages must be in supabase_realtime for server-validated postgres_changes delivery'
  )

  // Verify anonymous_messages has NO sender_id column
  const messagesTableDef = migration.match(/CREATE TABLE public\.anonymous_messages\b[\s\S]*?\);/)?.[0] || ''
  assert.equal(
    /sender_id/.test(messagesTableDef),
    false,
    'anonymous_messages must NOT contain a sender_id column'
  )
  assert.match(messagesTableDef, /sender_role\s+TEXT/)
  assert.match(messagesTableDef, /sender_alias\s+TEXT/)

  // Signaling does not use a private broadcast channel whose authorization
  // can remain cached after a room ends.
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]*?ON realtime\.messages/)
  assert.match(migration, /CREATE FUNCTION public\.anonymous_send_signal/)
  assert.match(migration, /CREATE FUNCTION public\.anonymous_poll_signals/)
})

test('[Static SQL] anonymous_send_message strips sender_id from return payload and client broadcast', () => {
  const sendFn = migration.match(/CREATE FUNCTION public\.anonymous_send_message\b[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(sendFn, 'anonymous_send_message must exist')

  // RPC returns is_self: true, sender_alias, sender_role, but NOT sender_id
  assert.match(sendFn, /'is_self',\s*true/)
  assert.match(sendFn, /'sender_alias',\s*v_my_alias/)
  assert.match(sendFn, /'sender_role',\s*v_my_role/)
  assert.equal(
    /'sender_id'/.test(sendFn.replace(/-- .*$/gm, '')),
    false,
    'anonymous_send_message must NOT return sender_id to client'
  )
})

test('[Static SQL] rate limit helper uses fixed window upsert pattern', () => {
  const helperFn = migration.match(/CREATE FUNCTION public\.anonymous_check_rate_limit\b[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(helperFn, 'anonymous_check_rate_limit must exist')

  assert.match(helperFn, /INSERT INTO public\.anonymous_rate_limits/)
  assert.match(helperFn, /ON CONFLICT \(user_id, action\) DO UPDATE/)
  assert.match(helperFn, /window_start\s*<\s*pg_catalog\.now\(\)\s*-\s*p_window/)
  assert.match(helperFn, /RETURN v_count <= p_max/)
})
