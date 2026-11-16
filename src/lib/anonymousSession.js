// Coordinates one mounted Anonymous page. The generation invalidates late
// join, poll, history and room callbacks; Stop waits for an in-flight join.
export function createAnonymousSessionGuard() {
  let generation = 0
  let mounted = false
  let joining = null
  let stopping = null

  const clear = (task, get, set) => {
    task.then(() => { if (get() === task) set(null) }, () => { if (get() === task) set(null) })
  }

  return {
    activate() { mounted = true; return ++generation },
    deactivate() { mounted = false; generation += 1 },
    current() { return generation },
    isCurrent(token) { return mounted && generation === token },
    invalidate() { return ++generation },
    beginJoin(request) {
      if (!mounted || joining || stopping) return null
      const token = ++generation
      const task = Promise.resolve().then(() => request(token))
      joining = task
      clear(task, () => joining, (value) => { joining = value })
      return { token, task }
    },
    stop(leave) {
      generation += 1
      if (stopping) return stopping
      const pending = joining
      const task = (async () => {
        let joinFailed = false
        if (pending) {
          try { await pending } catch { joinFailed = true }
        }
        await leave()
        if (joinFailed) {
          throw new Error('The join outcome is uncertain. Retry Stop before starting another search.')
        }
      })()
      stopping = task
      clear(task, () => stopping, (value) => { stopping = value })
      return task
    },
  }
}

// A remounted page in this tab must not start a new search before an earlier
// unmount's leave finishes. A failed cleanup stays visible until a retry works.
const pendingCleanups = new Map()

export function rememberAnonymousCleanup(userId, task) {
  pendingCleanups.set(userId, task)
  task.then(() => {
    if (pendingCleanups.get(userId) === task) pendingCleanups.delete(userId)
  }, () => {})
}

export function waitForAnonymousCleanup(userId) {
  return pendingCleanups.get(userId) || Promise.resolve()
}

export function clearAnonymousCleanup(userId) {
  pendingCleanups.delete(userId)
}

// Bind a request to the account that owns this page, even if the shared
// client's current account changes before its asynchronous fetch is dispatched.
export async function getAnonymousAccessToken(client, userId) {
  const { data, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw sessionError
  if (!userId || data?.session?.user?.id !== userId) {
    throw new Error('Your account changed; the Anonymous request was not sent.')
  }
  const token = data.session.access_token
  if (!token) throw new Error('Your session has no access token; the Anonymous request was not sent.')
  return token
}

// Never send an old page's leave under a different account's current session.
export async function leaveAnonymousSession(client, userId, roomId = null) {
  const token = await getAnonymousAccessToken(client, userId)
  const request = roomId
    ? client.rpc('anonymous_leave', { p_room_id: roomId })
    : client.rpc('anonymous_leave')
  const { data, error } = await request.setHeader('Authorization', `Bearer ${token}`)
  if (error) throw error
  if (data !== true) throw new Error('The server did not confirm the Anonymous session ended.')
}

/**
 * Robust, finally-safe exit coordinator for CampusAnonymous.
 * Always navigates to /dashboard using { replace: true }.
 * Cleans up generation, timers, WebRTC, channels, and leaves backend session.
 */
export async function executeAnonymousExit({
  sessionGuard,
  supabase,
  userId,
  roomId = null,
  hadSession = false,
  clearTimers,
  destroyWebRTC,
  destroyChannel,
  exitFullscreen,
  navigate,
  isExitingRef,
  timeoutMs = 2000,
}) {
  // Scenario F: Rapid exit clicks do not trigger duplicate cleanup
  if (isExitingRef?.current) {
    if (typeof navigate === 'function') {
      navigate('/dashboard', { replace: true })
    }
    return
  }
  if (isExitingRef) isExitingRef.current = true

  try {
    // 1. Invalidate pending matchmaking requests & increment generation
    sessionGuard?.invalidate?.()

    // 2. Stop heartbeat and queue polling
    clearTimers?.()

    // 3. Remove Supabase Realtime subscriptions
    destroyChannel?.()

    // 4. Close WebRTC connections & stop local camera and microphone tracks
    destroyWebRTC?.()

    // 5. Call the correct anonymous_leave RPC (bounded timeout, non-blocking on failure)
    if (hadSession && supabase && userId) {
      try {
        const cleanup = sessionGuard?.stop
          ? sessionGuard.stop(() => leaveAnonymousSession(supabase, userId, roomId))
          : leaveAnonymousSession(supabase, userId, roomId)

        rememberAnonymousCleanup(userId, cleanup)

        // Do not wait indefinitely for pending network requests
        const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs))
        await Promise.race([cleanup, timeout]).catch((err) => {
          console.warn('Anonymous exit leave RPC error:', err?.message || err)
        })
      } catch (err) {
        console.warn('Anonymous leave coordination error:', err?.message || err)
      }
    }

    // 6. Exit browser fullscreen if active
    if (exitFullscreen) {
      await exitFullscreen().catch(() => {})
    }
  } catch (err) {
    console.warn('Anonymous exit error:', err)
  } finally {
    // 7. Exit must ALWAYS navigate to /dashboard (using replace: true)
    try {
      if (typeof navigate === 'function') {
        navigate('/dashboard', { replace: true })
      } else if (typeof window !== 'undefined' && window.location) {
        window.location.replace('/dashboard')
      }
    } catch {
      if (typeof window !== 'undefined' && window.location) {
        window.location.replace('/dashboard')
      }
    }
  }
}
