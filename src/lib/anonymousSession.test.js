import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createAnonymousSessionGuard,
  rememberAnonymousCleanup,
  waitForAnonymousCleanup,
  clearAnonymousCleanup,
  getAnonymousAccessToken,
  leaveAnonymousSession,
} from './anonymousSession.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('[mock] Stop invalidates a late join and waits for it before leaving', async () => {
  const guard = createAnonymousSessionGuard()
  guard.activate()
  const join = deferred()
  const events = []
  const operation = guard.beginJoin(() => { events.push('join'); return join.promise })
  await Promise.resolve()
  const stopping = guard.stop(async () => { events.push('leave') })
  assert.equal(guard.isCurrent(operation.token), false)
  assert.deepEqual(events, ['join'])
  assert.equal(guard.beginJoin(() => {}), null)
  join.resolve({ matched: true, room_id: 'old-room' })
  await stopping
  assert.deepEqual(events, ['join', 'leave'])
})

test('[mock] Next cannot start a replacement until the old join and leave finish', async () => {
  const guard = createAnonymousSessionGuard()
  guard.activate()
  const join = deferred()
  const leave = deferred()
  const events = []
  const first = guard.beginJoin(() => { events.push('first join'); return join.promise })
  await Promise.resolve()
  const stop = guard.stop(() => { events.push('leave'); return leave.promise })
  assert.equal(guard.beginJoin(() => {}), null)
  join.resolve({ status: 'waiting' })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(guard.isCurrent(first.token), false)
  assert.equal(guard.beginJoin(() => {}), null)
  leave.resolve()
  await stop
  const next = guard.beginJoin(() => { events.push('next join'); return { status: 'waiting' } })
  assert.ok(next)
  await next.task
  assert.deepEqual(events, ['first join', 'leave', 'next join'])
})

test('[mock] an ambiguous join failure still leaves but does not claim a confirmed stop', async () => {
  const guard = createAnonymousSessionGuard()
  guard.activate()
  const join = deferred()
  const events = []
  const operation = guard.beginJoin(() => join.promise)
  operation.task.catch(() => {})
  await Promise.resolve()
  const stopping = guard.stop(async () => { events.push('leave') })
  join.reject(new Error('network lost'))
  await assert.rejects(stopping, /join outcome is uncertain/)
  assert.deepEqual(events, ['leave'])
  await guard.stop(async () => { events.push('retry leave') })
  assert.deepEqual(events, ['leave', 'retry leave'])
})

test('[mock] rapid joins, stale polls and old room callbacks cannot claim a later generation', async () => {
  const guard = createAnonymousSessionGuard()
  guard.activate()
  const join = deferred()
  const first = guard.beginJoin(() => join.promise)
  assert.equal(guard.beginJoin(() => {}), null)
  const waitingToken = first.token
  join.resolve({ status: 'waiting' })
  await first.task
  assert.equal(guard.isCurrent(waitingToken), true)
  const roomOne = guard.invalidate()
  assert.equal(guard.isCurrent(waitingToken), false)
  assert.equal(guard.isCurrent(roomOne), true)
  const roomTwo = guard.invalidate()
  assert.equal(guard.isCurrent(roomOne), false)
  assert.equal(guard.isCurrent(roomTwo), true)
  guard.deactivate()
  assert.equal(guard.isCurrent(roomTwo), false)
})

test('[mock] StrictMode activation replay invalidates old hydration without leaving', () => {
  const guard = createAnonymousSessionGuard()
  const first = guard.activate()
  guard.deactivate()
  const second = guard.activate()
  assert.equal(guard.isCurrent(first), false)
  assert.equal(guard.isCurrent(second), true)
})

test('[mock] remount waits for cleanup and retains a failed cleanup until cleared', async () => {
  const id = 'anonymous-session-test'
  const cleanup = deferred()
  rememberAnonymousCleanup(id, cleanup.promise)
  let finished = false
  const waiting = waitForAnonymousCleanup(id).then(() => { finished = true })
  await Promise.resolve()
  assert.equal(finished, false)
  cleanup.resolve()
  await waiting
  assert.equal(finished, true)
  const failed = Promise.reject(new Error('leave failed'))
  rememberAnonymousCleanup(id, failed)
  await assert.rejects(waitForAnonymousCleanup(id), /leave failed/)
  clearAnonymousCleanup(id)
  await assert.doesNotReject(waitForAnonymousCleanup(id))
})

test('[mock] leave verifies the current account and scopes known rooms', async () => {
  const calls = []
  const headers = []
  let currentUser = 'A'
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: currentUser }, access_token: `token-${currentUser}` } }, error: null }) },
    rpc(...args) {
      calls.push(args)
      const request = Promise.resolve({ data: true, error: null })
      request.setHeader = (...header) => { headers.push(header); return request }
      return request
    },
  }
  await leaveAnonymousSession(client, 'A', 'room-old')
  await leaveAnonymousSession(client, 'A')
  assert.deepEqual(calls, [
    ['anonymous_leave', { p_room_id: 'room-old' }],
    ['anonymous_leave'],
  ])
  assert.deepEqual(headers, [
    ['Authorization', 'Bearer token-A'],
    ['Authorization', 'Bearer token-A'],
  ])
  currentUser = 'B'
  await assert.rejects(leaveAnonymousSession(client, 'A', 'room-old'), /account changed/)
  assert.equal(calls.length, 2)
})

test('[mock] account verification and an unconfirmed leave fail closed', async () => {
  let session = { user: { id: 'A' }, access_token: 'token-A' }
  let result = { data: false, error: null }
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }) },
    rpc() {
      const request = Promise.resolve(result)
      request.setHeader = () => request
      return request
    },
  }
  assert.equal(await getAnonymousAccessToken(client, 'A'), 'token-A')
  await assert.rejects(leaveAnonymousSession(client, 'A'), /did not confirm/)
  session = { user: { id: 'B' }, access_token: 'token-B' }
  await assert.rejects(getAnonymousAccessToken(client, 'A'), /account changed/)
  session = { user: { id: 'A' } }
  await assert.rejects(getAnonymousAccessToken(client, 'A'), /no access token/)
  session = { user: { id: 'A' }, access_token: 'token-A' }
  result = { data: true, error: null }
  await assert.doesNotReject(leaveAnonymousSession(client, 'A'))
})

test('[mock] a leave retains the verified token when the shared account changes before dispatch', async () => {
  let currentUser = 'A'
  let authorization
  const client = {
    auth: { getSession: async () => ({ data: { session: {
      user: { id: currentUser }, access_token: `token-${currentUser}`,
    } } }) },
    rpc() {
      currentUser = 'B'
      const request = Promise.resolve({ data: true, error: null })
      request.setHeader = (name, value) => { authorization = [name, value]; return request }
      return request
    },
  }
  await leaveAnonymousSession(client, 'A')
  assert.equal(currentUser, 'B')
  assert.deepEqual(authorization, ['Authorization', 'Bearer token-A'])
})
