import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { communityCursorFilter, communityFriendRelationship, mergeCommunityMessages } from './community.js'

const migration = readFileSync(new URL('../../database/migration_campus_community.sql', import.meta.url), 'utf8')
const friendsMigration = readFileSync(new URL('../../database/migration_community_friends.sql', import.meta.url), 'utf8')
const page = readFileSync(new URL('../pages/Community.jsx', import.meta.url), 'utf8')
const moderation = readFileSync(new URL('../components/CommunityModeration.jsx', import.meta.url), 'utf8')
const friendsComponent = readFileSync(new URL('../components/CommunityFriends.jsx', import.meta.url), 'utf8')
const functionBody = (name) => migration.match(new RegExp(`CREATE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0] || ''
const friendsFunctionBody = (name) => friendsMigration.match(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0] || ''
const policy = (name) => migration.match(new RegExp(`CREATE POLICY "${name}"[\\s\\S]*?;`))?.[0] || ''

test('messages merge in chronological order without duplicates', () => {
  const first = { id: '00000000-0000-0000-0000-000000000001', created_at: '2026-01-01T10:00:00Z', content: 'old' }
  const second = { id: '00000000-0000-0000-0000-000000000002', created_at: '2026-01-01T10:00:00Z', content: 'second' }
  const merged = mergeCommunityMessages([second, first], [{ ...first, content: 'edited' }])
  assert.deepEqual(merged.map((message) => message.content), ['edited', 'second'])
})

test('older-message cursors reject arbitrary filter expressions', () => {
  const id = '00000000-0000-0000-0000-000000000001'
  assert.match(communityCursorFilter({ id, created_at: '2026-01-01T10:00:00+00:00' }), /id\.lt\./)
  assert.throws(() => communityCursorFilter({ id: `${id},sender_id.eq.bad`, created_at: '2026-01-01T10:00:00Z' }))
})

test('messages within one millisecond retain PostgreSQL timestamp order', () => {
  const later = { id: '00000000-0000-0000-0000-000000000001', created_at: '2026-01-01T10:00:00.123900Z' }
  const earlier = { id: '00000000-0000-0000-0000-000000000002', created_at: '2026-01-01T10:00:00.123100Z' }
  assert.deepEqual(mergeCommunityMessages([later], [earlier]).map((message) => message.id), [earlier.id, later.id])
})

test('stale history responses cannot restore an edited or removed message', () => {
  const old = { id: '00000000-0000-0000-0000-000000000001', created_at: '2026-01-01T10:00:00Z', content: 'old' }
  const edited = { ...old, content: 'new', edited_at: '2026-01-01T10:00:01Z' }
  const removed = { ...old, content: null, deleted_at: '2026-01-01T10:00:02Z' }
  assert.equal(mergeCommunityMessages([edited], [old])[0].content, 'new')
  assert.equal(mergeCommunityMessages([removed], [edited])[0].content, null)
})

test('directory actions distinguish blocks, friends and request direction', () => {
  const friends = [{ id: 'friend' }]
  const requests = [{ peerId: 'incoming', direction: 'incoming' }, { peerId: 'outgoing', direction: 'outgoing' }]
  const blocked = [{ id: 'blocked' }, { id: 'friend' }]
  assert.equal(communityFriendRelationship('blocked', friends, requests, blocked), 'blocked')
  assert.equal(communityFriendRelationship('friend', friends, requests, blocked), 'blocked')
  assert.equal(communityFriendRelationship('friend', friends, requests, []), 'friend')
  assert.equal(communityFriendRelationship('incoming', friends, requests, blocked), 'incoming')
  assert.equal(communityFriendRelationship('outgoing', friends, requests, blocked), 'outgoing')
  assert.equal(communityFriendRelationship('new', friends, requests, blocked), 'none')
})

test('migration keeps direct-message reads participant-only and client writes revoked', () => {
  const policy = migration.match(/CREATE POLICY "community direct messages: participants read"[\s\S]*?;\n/)?.[0] || ''
  const conversationPolicy = migration.match(/CREATE POLICY "community conversations: participants read"[\s\S]*?;\n/)?.[0] || ''
  assert.match(policy, /auth\.uid\(\).*IN \(c\.user_a, c\.user_b\)/s)
  assert.doesNotMatch(policy, /is_admin/)
  assert.match(conversationPolicy, /auth\.uid\(\).*IN \(user_a, user_b\)/s)
  assert.doesNotMatch(conversationPolicy, /is_admin/)
  assert.match(migration, /community_direct_messages,[\s\S]*?community_rate_limits FROM PUBLIC, anon, authenticated/)
  assert.match(functionBody('community_send_direct_message'), /VALUES \(p_conversation, auth\.uid\(\),/)
})

test('conversation, block and report RPCs contain server-side authorization checks', () => {
  const start = functionBody('community_start_conversation')
  const send = functionBody('community_send_direct_message')
  const report = functionBody('community_report_message')
  assert.match(start, /community_lock_pair\(p_other\)[\s\S]*community_blocks/)
  assert.match(send, /community_lock_pair\(v_other\)[\s\S]*community_blocks/)
  assert.match(start, /blocker_id = auth\.uid\(\) AND blocked_id = p_other/)
  assert.match(start, /blocker_id = p_other AND blocked_id = auth\.uid\(\)/)
  assert.match(send, /blocker_id = auth\.uid\(\) AND blocked_id = v_other/)
  assert.match(send, /blocker_id = v_other AND blocked_id = auth\.uid\(\)/)
  assert.match(start, /community_require_directory_pair\(p_other\)/)
  assert.match(send, /community_require_directory_pair\(v_other\)/)
  assert.match(send, /WHERE id = p_conversation AND auth\.uid\(\) IN \(user_a, user_b\)/)
  assert.match(send, /community_take_limit\('message'/)
  assert.match(send, /v_previous \+ interval '1 microsecond'/)
  assert.match(functionBody('community_take_limit'), /FOR UPDATE/)
  assert.match(functionBody('community_take_limit'), /v_used >= p_max/)
  assert.match(report, /auth\.uid\(\) IN \(c\.user_a, c\.user_b\)/)
  assert.match(functionBody('community_mark_read'), /auth\.uid\(\) IN \(c\.user_a, c\.user_b\)/)
  assert.match(functionBody('community_conversation_list'), /WHERE auth\.uid\(\) IN \(c\.user_a, c\.user_b\)/)
  assert.match(functionBody('community_review_report'), /public\.is_admin\(\) IS NOT TRUE/)
  assert.match(functionBody('community_delete_message'), /public\.is_admin\(\) IS NOT TRUE/)
  assert.doesNotMatch(functionBody('community_delete_message'), /community_direct_messages/)
  assert.doesNotMatch(functionBody('community_conversation_list'), /public\.is_admin/)
})

test('only the participant-checked send RPC inserts or changes direct messages', () => {
  const functions = [...migration.matchAll(/CREATE FUNCTION public\.(community_[a-z_]+)\(/g)].map((match) => match[1])
  const mutators = functions.filter((name) =>
    /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.community_direct_messages\b/i.test(functionBody(name)))
  assert.deepEqual(mutators, ['community_send_direct_message'])
  assert.doesNotMatch(functionBody('community_report_message'), /\bm\.content\b/)
})

test('all community definer functions use a fixed search path and explicit execution grants', () => {
  const internal = new Set([
    'community_take_limit', 'community_lock_pair',
    'community_require_directory_pair', 'community_sync_profile_name',
  ])
  const functions = [...migration.matchAll(/CREATE FUNCTION public\.(community_[a-z_]+)\(/g)].map((match) => match[1])
  assert.equal(functions.length, 16)
  for (const name of functions) {
    assert.match(functionBody(name), /SECURITY DEFINER SET search_path = ''/)
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^;]*\\) FROM PUBLIC, anon, authenticated;`))
    const grant = new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]*\\) TO authenticated;`)
    if (internal.has(name)) assert.doesNotMatch(migration, grant)
    else assert.match(migration, grant)
  }
})

test('private Realtime topics do not subscribe to private-table deletes', () => {
  assert.match(page, /campuscommunity:user:\$\{user\.id\}[\s\S]*?private: true/)
  assert.match(page, /postgres_changes_options:\s*\{\s*wait:\s*true\s*\}/)
  assert.match(page, /await supabase\.realtime\.setAuth\(\)/)
  assert.match(page, /await communityChannelRemoval/)
  assert.match(page, /\.on\('system', \{\},[\s\S]*?payload\.extension !== 'postgres_changes'[\s\S]*?markChangesReady\(true\)/)
  assert.match(page, /\}, \[joined, user\?\.id, session\?\.user\?\.id, hasSessionToken, loadConversations, loadFriends, markRead\]\)/)
  assert.match(page, /event: '\*', schema: 'public', table: 'community_messages'/)
  const privateListeners = page.split('\n').filter((line) =>
    line.includes(".on('postgres_changes'") &&
    (line.includes("table: 'community_direct_messages'") || line.includes("table: 'community_conversations'")))
  assert.equal(privateListeners.length, 3)
  assert.ok(privateListeners.every((line) => !line.includes("event: '*'") && !line.includes("event: 'DELETE'")))
  assert.match(migration, /ARRAY\['community_messages', 'community_conversations', 'community_direct_messages'\]/)
  assert.match(migration, /GRANT SELECT ON public\.community_channels, public\.community_messages, public\.community_conversations,[\s\S]*?public\.community_direct_messages,[\s\S]*?TO authenticated;/)
})

test('Realtime policies restrict the whole topic namespace despite permissive policies', () => {
  const allow = policy('campuscommunity: receive own private topic')
  const reads = policy('campuscommunity: restrict topic reads')
  const writes = policy('campuscommunity: block topic writes')
  const ownTopic = /'campuscommunity:user:' \|\| \(SELECT auth\.uid\(\)\)::text/
  assert.match(allow, /FOR SELECT TO authenticated/)
  assert.match(allow, ownTopic)
  assert.match(reads, /AS RESTRICTIVE FOR SELECT TO PUBLIC/)
  assert.match(reads, ownTopic)
  assert.match(reads, /extension = 'broadcast'/)
  assert.match(reads, /current_user = 'authenticated'/)
  assert.match(reads, /topic = \(SELECT realtime\.topic\(\)\)/)
  assert.match(writes, /AS RESTRICTIVE FOR INSERT TO PUBLIC/)
  for (const rule of [reads, writes]) {
    assert.match(rule, /COALESCE\(\(SELECT realtime\.topic\(\)\), ''\) NOT LIKE 'campuscommunity:user:%'/)
    assert.match(rule, /COALESCE\(topic, ''\) NOT LIKE 'campuscommunity:user:%'/)
  }
  assert.match(migration, /oid = 'realtime\.messages'::regclass AND relrowsecurity/)
  assert.doesNotMatch(migration, /ALTER TABLE realtime\.messages ENABLE ROW LEVEL SECURITY/)
})

test('frontend community RPC names and named parameters exist and are granted', () => {
  const calls = [...`${page}\n${moderation}`.matchAll(
    /\.rpc\('(community_[a-z_]+)'(?:,\s*\{([^}]*)\})?\)/g,
  )]
  assert.equal(calls.length, 13)
  for (const [, name, params = ''] of calls) {
    const declaration = functionBody(name).match(
      new RegExp(`CREATE FUNCTION public\\.${name}\\(([^)]*)\\)`),
    )?.[1]
    assert.notEqual(declaration, undefined, `Missing SQL function ${name}`)
    for (const [, param] of params.matchAll(/\b(p_[a-z_]+)\s*:/g)) {
      assert.match(declaration, new RegExp(`\\b${param}\\b`), `${name} is missing ${param}`)
    }
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]*\\) TO authenticated;`))
  }
})

test('first install checks dependencies and never drops or deletes existing records', () => {
  assert.match(migration, /attname = 'full_name'[\s\S]*?'text'::regtype/)
  assert.match(migration, /to_regprocedure\('public\.is_admin\(\)'\)/)
  assert.match(migration, /pubname = 'supabase_realtime' AND pubinsert AND pubupdate/)
  assert.match(migration, /Existing public\.% conflicts with this first-install migration/)
  assert.match(migration, /p\.proname = ANY/)
  const topLevel = migration.replace(/\$\$[\s\S]*?\$\$/g, '')
  assert.doesNotMatch(topLevel, /^\s*(DROP|TRUNCATE|DELETE\s+FROM)\b/im)
  assert.match(topLevel, /\bBEGIN;/)
  assert.match(topLevel, /\bCOMMIT;/)
})

test('friend tables limit reads to the two users and forbid direct client writes', () => {
  assert.match(friendsMigration, /CHECK \(requester_id <> recipient_id\)/)
  assert.match(friendsMigration, /LEAST\(requester_id, recipient_id\), GREATEST\(requester_id, recipient_id\)\)\s*WHERE status = 'pending'/)
  assert.match(friendsMigration, /CHECK \(user_a < user_b\)/)
  assert.match(friendsMigration, /UNIQUE \(user_a, user_b\)/)
  assert.match(friendsMigration, /REVOKE ALL ON public\.community_friend_requests, public\.community_friendships\s*FROM PUBLIC, anon, authenticated/)
  assert.match(friendsMigration, /GRANT SELECT ON public\.community_friend_requests, public\.community_friendships TO authenticated/)
  const requestsPolicy = friendsMigration.match(/CREATE POLICY "community friend requests: participants read"[\s\S]*?;/)?.[0] || ''
  const friendsPolicy = friendsMigration.match(/CREATE POLICY "community friendships: participants read"[\s\S]*?;/)?.[0] || ''
  assert.match(requestsPolicy, /auth\.uid\(\).*IN \(requester_id, recipient_id\)/)
  assert.match(friendsPolicy, /auth\.uid\(\).*IN \(user_a, user_b\)/)
  assert.doesNotMatch(requestsPolicy + friendsPolicy, /is_admin/)
})

test('request transitions derive identities, require consent and serialize each pair', () => {
  const send = friendsFunctionBody('community_send_friend_request')
  const respond = friendsFunctionBody('community_respond_friend_request')
  const cancel = friendsFunctionBody('community_cancel_friend_request')
  assert.match(send, /p_other = auth\.uid\(\)/)
  assert.match(send, /community_lock_pair\(p_other\)[\s\S]*community_require_directory_pair\(p_other\)[\s\S]*community_blocks/)
  assert.match(send, /blocker_id = auth\.uid\(\) AND blocked_id = p_other/)
  assert.match(send, /blocker_id = p_other AND blocked_id = auth\.uid\(\)/)
  assert.match(send, /community_friendships[\s\S]*AND active/)
  assert.match(send, /community_take_limit\('friend_request', 20, interval '1 hour'\)/)
  assert.match(send, /VALUES \(auth\.uid\(\), p_other\)/)
  assert.match(respond, /recipient_id = auth\.uid\(\)[\s\S]*community_lock_pair\(v_other\)[\s\S]*status = 'pending' FOR UPDATE/)
  assert.match(respond, /IF p_accept THEN[\s\S]*community_require_directory_pair\(v_other\)[\s\S]*community_blocks/)
  assert.match(respond, /INSERT INTO public\.community_friendships[\s\S]*LEAST\(auth\.uid\(\), v_other\)[\s\S]*GREATEST\(auth\.uid\(\), v_other\)/)
  assert.match(cancel, /requester_id = auth\.uid\(\)[\s\S]*community_lock_pair\(v_other\)[\s\S]*status = 'pending'/)
  assert.match(friendsFunctionBody('community_unfriend'), /community_lock_pair\(p_other\)[\s\S]*SET active = false/)
})

test('friendship and blocks gate both DM RPCs while preserving participant-only history', () => {
  const start = friendsFunctionBody('community_start_conversation')
  const send = friendsFunctionBody('community_send_direct_message')
  const list = friendsFunctionBody('community_conversation_list')
  const block = friendsFunctionBody('community_block_user')
  for (const [body, other] of [[start, 'p_other'], [send, 'v_other']]) {
    assert.match(body, new RegExp(`community_lock_pair\\(${other}\\)[\\s\\S]*community_blocks[\\s\\S]*community_friendships`))
    assert.match(body, new RegExp(`user_a = LEAST\\(auth\\.uid\\(\\), ${other}\\)`))
    assert.match(body, new RegExp(`user_b = GREATEST\\(auth\\.uid\\(\\), ${other}\\) AND active`))
    assert.match(body, new RegExp(`blocker_id = ${other} AND blocked_id = auth\\.uid\\(\\)`))
  }
  assert.match(send, /WHERE id = p_conversation AND auth\.uid\(\) IN \(user_a, user_b\)/)
  assert.match(list, /community_friendships f[\s\S]*f\.active/)
  assert.match(list, /WHERE auth\.uid\(\) IN \(c\.user_a, c\.user_b\)/)
  assert.doesNotMatch(list, /is_admin/)
  assert.match(block, /community_lock_pair\(p_other\)[\s\S]*UPDATE public\.community_friendships SET active = false/)
  assert.match(block, /UPDATE public\.community_friend_requests SET status = 'cancelled'/)
  assert.doesNotMatch(friendsMigration, /DELETE FROM public\.community_(?:direct_messages|conversations|conversation_participants)/)
})

test('friendship RPCs have fixed search paths, restricted grants and matching frontend arguments', () => {
  const functions = [
    'community_send_friend_request', 'community_respond_friend_request',
    'community_cancel_friend_request', 'community_unfriend',
    'community_start_conversation', 'community_send_direct_message',
    'community_block_user', 'community_conversation_list',
  ]
  for (const name of functions) {
    assert.match(friendsFunctionBody(name), /SECURITY DEFINER SET search_path = ''/)
    assert.match(friendsMigration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^;]*\\) FROM PUBLIC, anon, authenticated;`))
    assert.match(friendsMigration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]*\\) TO authenticated;`))
  }
  const calls = [...page.matchAll(/friendAction\('(community_[a-z_]+)',\s*\{([^}]*)\}/g)]
  assert.equal(calls.length, 4)
  for (const [, name, params] of calls) {
    const declaration = friendsFunctionBody(name).match(new RegExp(`FUNCTION public\\.${name}\\(([^)]*)\\)`))?.[1]
    assert.notEqual(declaration, undefined)
    for (const [, param] of params.matchAll(/\b(p_[a-z_]+)\s*:/g)) assert.match(declaration, new RegExp(`\\b${param}\\b`))
  }
})

test('friend requests and friendships use private participant-scoped INSERT and UPDATE notifications', () => {
  const listeners = page.split('\n').filter((line) => line.includes(".on('postgres_changes'") &&
    (line.includes("table: 'community_friend_requests'") || line.includes("table: 'community_friendships'")))
  assert.equal(listeners.length, 4)
  assert.ok(listeners.every((line) => line.includes("event: 'INSERT'") || line.includes("event: 'UPDATE'")))
  assert.match(friendsMigration, /ARRAY\['community_friend_requests', 'community_friendships'\]/)
  assert.match(friendsComponent, /incoming\.length/)
  assert.match(friendsComponent, /onRespond\(request\.id, true\)/)
  assert.match(friendsComponent, /onRespond\(request\.id, false\)/)
  assert.match(friendsComponent, /onCancel\(request\.id\)/)
  assert.match(friendsComponent, /onUnfriend\(friend\.id, friend\.name\)/)
})
