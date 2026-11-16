// Static SQL/frontend contracts and mocked client behavior. These are NOT
// authenticated PostgreSQL, Storage, Realtime, or concurrency tests.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AnonymousWebRTC } from './anonymousWebrtc.js'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const anonymousSql = read('database/migration_campus_anonymous.sql')
const marketSql = read('database/migration_campus_market.sql')
const completionSql = read('database/migration_campus_market_completion.sql')
const anonymousPage = read('src/pages/Anonymous.jsx')
const rtcSource = read('src/lib/anonymousWebrtc.js')
const moderation = read('src/components/AnonymousModeration.jsx')
const marketPage = read('src/pages/Market.jsx')
const marketLib = read('src/lib/market.js')
const marketModeration = read('src/components/MarketModeration.jsx')

function sqlFunction(sql, name) {
  const result = sql.match(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\b[\\s\\S]*?\\n\\$\\$;`))?.[0]
  assert.ok(result, `missing SQL function ${name}`)
  return result
}

test('[static] direct anonymous message access is participant-only, not administrator-wide', () => {
  const policy = anonymousSql.match(/CREATE POLICY anonymous_messages_participant_select[\s\S]*?;/)?.[0]
  assert.ok(policy)
  assert.match(policy, /public\.anonymous_is_room_participant\(room_id\)/)
  assert.doesNotMatch(policy, /is_admin|OR\s+true/i)
  const helper = sqlFunction(anonymousSql, 'anonymous_is_room_participant')
  assert.match(helper, /r\.id = p_room_id/)
  assert.match(helper, /r\.user_1 = auth\.uid\(\) OR r\.user_2 = auth\.uid\(\)/)
  assert.match(helper, /SECURITY DEFINER\s+SET search_path = ''/)
  assert.doesNotMatch(helper, /p_uid|is_admin/)
})

test('[static] report transcript checks admin, scopes to report, and exposes no student UUID', () => {
  const fn = sqlFunction(anonymousSql, 'anonymous_admin_get_report_transcript')
  assert.match(fn, /public\.is_admin\(\) IS NOT TRUE/)
  assert.match(fn, /WHERE id = p_report_id/)
  assert.match(fn, /WHERE m\.room_id = v_report\.room_id/)
  assert.doesNotMatch(fn, /sender_user_id|v_room\.user_[12]/)
  const returnedColumns = fn.match(/RETURNS TABLE \([\s\S]*?\)/)?.[0] || ''
  assert.doesNotMatch(returnedColumns, /(?:reporter|reported|sender_user|user_[12])_?id/i)
  assert.match(moderation, /rpc\('anonymous_admin_get_report_transcript'/)
})

test('[static] all anonymous definers have empty search paths and schema-qualified application tables', () => {
  const definitions = anonymousSql.match(/CREATE FUNCTION public\.\w+[\s\S]*?\n\$\$;/g) || []
  assert.ok(definitions.length >= 14)
  for (const fn of definitions) {
    if (!fn.includes('SECURITY DEFINER')) continue
    assert.match(fn, /SET search_path = ''/)
    assert.doesNotMatch(fn, /\b(?:FROM|JOIN|UPDATE|INTO)\s+anonymous_(?:rooms|messages|reports|blocks|queue|signals|video_sessions|rate_limits)\b/i)
  }
})

test('[static] signaling checks room, state, event type, size, rates and current session', () => {
  const send = sqlFunction(anonymousSql, 'anonymous_send_signal')
  const poll = sqlFunction(anonymousSql, 'anonymous_poll_signals')
  for (const event of ['video_request', 'video_accept', 'video_reject', 'video_offer', 'video_answer', 'video_ice', 'video_end']) {
    assert.ok(send.includes(`'${event}'`), `missing ${event}`)
  }
  assert.match(send, /p_event IS NULL OR p_event NOT IN/)
  assert.match(send, /octet_length\(p_payload::text\) > 32768/)
  assert.match(send, /octet_length\(p_payload::text\) > 4096/)
  assert.match(send, /'signal_send', 120, INTERVAL '1 minute'/)
  assert.match(poll, /'signal_poll', 90, INTERVAL '1 minute'/)
  assert.match(send, /anonymous_rooms WHERE id = p_room_id FOR UPDATE/)
  assert.match(send, /v_room\.status <> 'active'/)
  assert.match(poll, /v_room\.status <> 'active'/)
  assert.match(send, /v_session\.session_id <> p_session_id/)
  assert.match(send, /Video handshake has expired/)
  assert.match(send, /v_session\.updated_at <= pg_catalog\.now\(\) - INTERVAL '2 minutes'/)
  assert.match(send, /v_session\.status = 'connected'\s+OR v_session\.updated_at/)
  assert.match(send, /v_role <> v_session\.requester_role AND v_session\.status = 'requested'/)
  assert.match(poll, /session_id = v_session\.session_id/)
  assert.match(poll, /sender_role <> v_role/)
  assert.match(poll, /created_at > pg_catalog\.now\(\) - INTERVAL '2 minutes'/)
  assert.doesNotMatch(rtcSource, /\.channel\(|type:\s*'broadcast'/)
  assert.doesNotMatch(anonymousPage, /event:\s*'room_ended'|\.on\('broadcast'/)
})

test('[static] market patch compares complete policy definitions and preserves existing policies', () => {
  assert.match(completionSql, /pg_catalog\.pg_get_expr\(p\.polqual/)
  for (const field of ['polcmd', 'polpermissive', 'polroles', 'using_expr', 'check_expr']) {
    assert.match(completionSql, new RegExp(`v_existing\\.${field}`))
  }
  assert.match(completionSql, /has an unexpected definition; inspect it before proceeding/)
  assert.doesNotMatch(completionSql, /DROP POLICY|ALTER POLICY/i)
  assert.match(completionSql, /'campus_market_guard_select', 'RESTRICTIVE'/)
  assert.match(completionSql, /'campus_market_guard_insert', 'RESTRICTIVE'/)
  assert.match(completionSql, /'campus_market_guard_update', 'RESTRICTIVE'/)
  assert.match(completionSql, /'campus_market_guard_delete', 'RESTRICTIVE'/)
  assert.match(completionSql, /owner_id = \(SELECT auth\.uid\(\)::text\)/)
  assert.match(completionSql, /bucket_id <> 'campus-market' OR/)
  assert.match(completionSql, /false, 5242880/)
  assert.match(completionSql, /ARRAY\['image\/jpeg', 'image\/png', 'image\/webp', 'image\/gif'\]/)
  assert.match(completionSql, /WHERE storage\.buckets\.name = 'campus-market'/)
  assert.match(marketLib, /'image\/jpeg': 'jpg'[\s\S]*?'image\/png': 'png'[\s\S]*?'image\/webp': 'webp'[\s\S]*?'image\/gif': 'gif'/)
})

test('[static] frontend RPC argument names match the locally inspected migrations', () => {
  const sources = [
    [anonymousPage + rtcSource + moderation, anonymousSql, 'anonymous_'],
    [marketPage + marketModeration, marketSql + completionSql, 'market_'],
    [marketPage, read('database/migration_community_friends.sql'), 'community_'],
  ]
  let calls = 0
  for (const [source, sql, prefix] of sources) {
    const callPattern = /\.rpc\('([a-z_]+)'(?:,\s*\{([\s\S]*?)\})?\)/g
    for (const [, name, argumentsText = ''] of source.matchAll(callPattern)) {
      if (!name.startsWith(prefix)) continue
      calls++
      const signature = sql.match(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS`, 'i'))?.[1]
      assert.notEqual(signature, undefined, `missing ${name}`)
      const declared = [...signature.matchAll(/\b(p_[a-z_]+)\s+(?:UUID|TEXT|JSONB|BIGINT|NUMERIC)/gi)].map((m) => m[1])
      const passed = [...argumentsText.matchAll(/\b(p_[a-z_]+)\s*:/g)].map((m) => m[1])
      for (const arg of passed) assert.ok(declared.includes(arg), `${name} does not declare ${arg}`)
      for (const arg of declared) {
        if (new RegExp(`\\b${arg}\\s+[^,]+\\s+DEFAULT\\b`, 'i').test(signature)) continue
        assert.ok(passed.includes(arg), `${name} requires ${arg}`)
      }
    }
  }
  assert.ok(calls >= 17, `only found ${calls} frontend RPC calls`)
})

function makeRtc() {
  const results = []
  const calls = []
  const client = {
    async rpc(name, args) {
      calls.push({ name, args })
      if (name === 'anonymous_poll_signals') return { data: results.shift() || { room_active: true, events: [] }, error: null }
      return { data: { session_id: 'current-call' }, error: null }
    },
    channel() { throw new Error('Broadcast channels must not be used for signaling') },
  }
  const rtc = new AnonymousWebRTC({ roomId: 'room-a', supabase: client })
  clearInterval(rtc.pollTimer)
  return { rtc, results, calls }
}

test('[mock] unconsented offers and signals for an older call are ignored', async () => {
  const { rtc, results, calls } = makeRtc()
  await Promise.resolve()
  let offers = 0
  rtc._handleOffer = async () => { offers++ }
  results.push({ room_active: true, session_id: 'old-call', session_status: 'offered', events: [
    { id: 1, session_id: 'old-call', event: 'video_offer', payload: {} },
  ] })
  await rtc._pollSignals()
  assert.equal(offers, 0)
  await rtc.requestCall()
  assert.equal(rtc.sessionId, 'current-call')
  results.push({ room_active: true, session_id: 'old-call', session_status: 'offered', events: [
    { id: 2, session_id: 'old-call', event: 'video_offer', payload: {} },
    { id: 3, session_id: 'old-call', event: 'video_accept', payload: {} },
  ] })
  await rtc._pollSignals()
  assert.equal(offers, 0)
  assert.equal(rtc.callState, 'requesting')
  assert.ok(calls.some((call) => call.name === 'anonymous_send_signal' && call.args.p_event === 'video_request'))
  rtc.destroy()
})

test('[mock] a delayed poll cannot restore a call after local cleanup', async () => {
  const { rtc } = makeRtc()
  await Promise.resolve()
  let resolvePoll
  rtc.supabase.rpc = () => new Promise((resolve) => { resolvePoll = resolve })
  const pending = rtc._pollSignals()
  rtc._finishCall()
  resolvePoll({ data: { room_active: true, session_id: 'old', session_status: 'requested', events: [
    { id: 1, session_id: 'old', event: 'video_request', payload: {} },
  ] }, error: null })
  await pending
  assert.equal(rtc.callState, 'idle')
  assert.equal(rtc.sessionId, null)
  rtc.destroy()
})

test('[mock] a video request completing after cancellation is ended server-side', async () => {
  const { rtc } = makeRtc()
  await Promise.resolve()
  let finishRequest
  const calls = []
  rtc.supabase.rpc = (name, args) => {
    calls.push({ name, args })
    if (args.p_event === 'video_request') {
      return new Promise((resolve) => { finishRequest = resolve })
    }
    return Promise.resolve({ data: {}, error: null })
  }
  const pending = rtc.requestCall()
  rtc.endCall()
  finishRequest({ data: { session_id: 'late-call' }, error: null })
  await pending
  await Promise.resolve()
  assert.equal(rtc.sessionId, null)
  assert.equal(rtc.callState, 'idle')
  assert.ok(calls.some((call) => call.args.p_event === 'video_end' && call.args.p_session_id === 'late-call'))
  rtc.destroy()
})

test('[mock] a reloaded client closes rather than resumes an abandoned call', async () => {
  const { rtc, results, calls } = makeRtc()
  await Promise.resolve()
  results.push({ room_active: true, session_id: 'abandoned', session_status: 'connected', events: [] })
  await rtc._pollSignals()
  assert.ok(calls.some((call) => call.args.p_event === 'video_end' && call.args.p_session_id === 'abandoned'))
  assert.equal(rtc.callState, 'idle')
  assert.equal(rtc.sessionId, null)
  rtc.destroy()
})

test('[mock] late callbacks from a closed peer cannot restore a call', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'RTCPeerConnection')
  Object.defineProperty(globalThis, 'RTCPeerConnection', {
    configurable: true,
    value: class {
      constructor() { this.connectionState = 'connected'; this.iceConnectionState = 'connected' }
      close() {}
    },
  })
  const { rtc, calls } = makeRtc()
  try {
    await Promise.resolve()
    let streams = 0
    rtc.onRemoteStream = () => { streams++ }
    rtc.sessionId = 'old'
    rtc._setCallState('connecting')
    rtc._createPeerConnection()
    const connection = rtc.peerConnection
    rtc._finishCall()
    connection.ontrack({ streams: [{}] })
    connection.onconnectionstatechange()
    connection.oniceconnectionstatechange()
    connection.onicecandidate({ candidate: { toJSON: () => ({ candidate: 'old' }) } })
    assert.equal(rtc.callState, 'idle')
    assert.equal(streams, 0)
    assert.equal(calls.filter((call) => call.args.p_event === 'video_ice').length, 0)
  } finally {
    rtc.destroy()
    if (original) Object.defineProperty(globalThis, 'RTCPeerConnection', original)
    else delete globalThis.RTCPeerConnection
  }
})

test('[mock] only the room status RPC result ends the chat', async () => {
  const { rtc, results } = makeRtc()
  await Promise.resolve()
  let ended = 0
  rtc.onRoomEnded = () => { ended++ }
  results.push({ room_active: true, session_id: 'fake', session_status: 'ended', events: [
    { id: 1, session_id: 'fake', event: 'room_ended', payload: {} },
  ] })
  await rtc._pollSignals()
  assert.equal(ended, 0)
  results.push({ room_active: false, events: [] })
  await rtc._pollSignals()
  assert.equal(ended, 1)
  assert.equal(rtc.destroyed, true)
})
