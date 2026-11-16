// src/pages/Anonymous.jsx — CampusAnonymous: Retro Minimal Omegle-Style 1-on-1 Chat & Video
//
// Layout & Interaction inspired by minimal Omegle split-stage:
// - Left (38%): Permanent stacked video panels for Stranger & You with embedded cam/mic controls
// - Right (62%): Clean, integrated inline text chat with subbar
// - Bottom Dock: Grouped tactile Start, Next, Stop buttons + inline chat input form
// - Dual-consent video call handshake preserved
// - Zero real identities exposed — random aliases only

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Ghost,
  Video,
  VideoOff,
  Mic,
  MicOff,
  UserX,
  Flag,
  X,
  AlertTriangle,
  Loader2,
  Lock,
  ArrowLeft,
  Maximize,
  Minimize,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  ANONYMOUS_STATUS,
  REPORT_REASONS,
  validateAnonymousMessage,
  validateAnonymousReport,
  formatMessageTime,
  requestBrowserFullscreen,
  exitBrowserFullscreen,
} from '../lib/anonymous'
import { AnonymousWebRTC } from '../lib/anonymousWebrtc'
import {
  createAnonymousSessionGuard,
  rememberAnonymousCleanup,
  waitForAnonymousCleanup,
  clearAnonymousCleanup,
  getAnonymousAccessToken,
  leaveAnonymousSession,
} from '../lib/anonymousSession'

// Helper to generate unique keys for ephemeral system notes
let sysMsgCounter = 0
const createSysId = (prefix) => `${prefix}-${++sysMsgCounter}`

export default function Anonymous() {
  const { user } = useAuth()
  return <AnonymousWorkspace key={user?.id || 'signed-out'} />
}

function AnonymousWorkspace() {
  const { user } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()

  // Fullscreen tracking state
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  )

  // Listen to native browser fullscreen changes (e.g. user pressed Escape)
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // Chat & Matchmaking states
  const [status, setStatus] = useState(ANONYMOUS_STATUS.IDLE)
  const [roomId, setRoomId] = useState(null)
  const [myAlias, setMyAlias] = useState('')
  const [partnerAlias, setPartnerAlias] = useState('')
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [searching, setSearching] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [stopFailed, setStopFailed] = useState(false)
  const [errorBanner, setErrorBanner] = useState(null)
  const [systemNotice, setSystemNotice] = useState(null)

  // Report Modal states
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0])
  const [reportSnippet, setReportSnippet] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

  // Handle Escape key: close report modal if open, but DO NOT exit chat
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (reportModalOpen) {
          setReportModalOpen(false)
        }
        // Native browser handles exiting fullscreen on Escape.
        // We preserve the active conversation and state.
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reportModalOpen])

  // Video call states
  const [videoCallState, setVideoCallState] = useState('idle') // idle | requesting | incoming_request | connecting | connected | ended
  const [cameraActive, setCameraActive] = useState(true)
  const [micActive, setMicActive] = useState(true)

  // Refs
  const webrtcRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const messagesEndRef = useRef(null)
  const heartbeatTimerRef = useRef(null)
  const matchPollTimerRef = useRef(null)
  const channelRef = useRef(null)
  const roomRef = useRef(null)
  const ownsSessionRef = useRef(false)
  const reportPendingRef = useRef(false)
  const stopRequestRef = useRef(null)
  const intentRef = useRef(0)
  const [sessionGuard] = useState(createAnonymousSessionGuard)

  const clearQueueTimers = useCallback(() => {
    clearInterval(heartbeatTimerRef.current)
    clearInterval(matchPollTimerRef.current)
    heartbeatTimerRef.current = null
    matchPollTimerRef.current = null
  }, [])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Clear system notices after 5 seconds
  useEffect(() => {
    if (!systemNotice) return
    const t = setTimeout(() => setSystemNotice(null), 5000)
    return () => clearTimeout(t)
  }, [systemNotice])

  // StrictMode's setup/cleanup replay must not leave a session the page has
  // not started or restored. Real unmounts invalidate callbacks immediately.
  useEffect(() => {
    sessionGuard.activate()
    return () => {
      sessionGuard.deactivate()
      intentRef.current += 1
      clearQueueTimers()
      if (webrtcRef.current) {
        webrtcRef.current.destroy()
        webrtcRef.current = null
      }
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (ownsSessionRef.current && supabase && userId) {
        const previousRoom = roomRef.current
        const cleanup = sessionGuard.stop(() => leaveAnonymousSession(supabase, userId, previousRoom))
        rememberAnonymousCleanup(userId, cleanup)
        cleanup.catch((err) => console.warn('Cleanup leave error:', err.message))
      }
    }
  }, [userId, sessionGuard, clearQueueTimers])

  // ─── WebRTC Setup ───────────────────────────────────────────
  const initWebRTC = useCallback((activeRoomId, token) => {
    if (!supabase || !activeRoomId) return

    if (webrtcRef.current) {
      webrtcRef.current.destroy()
    }
    setCameraActive(true)
    setMicActive(true)

    const rtc = new AnonymousWebRTC({
      roomId: activeRoomId,
      supabase,
      onCallStateChange: (state) => {
        if (!sessionGuard.isCurrent(token)) return
        setVideoCallState(state)
        if (state === 'idle') {
          // A later call gets fresh enabled tracks; keep the controls truthful.
          setCameraActive(true)
          setMicActive(true)
        }
        if (state === 'connected' && rtc.localStream && localVideoRef.current) {
          localVideoRef.current.srcObject = rtc.localStream
        }
      },
      onRemoteStream: (stream) => {
        if (!sessionGuard.isCurrent(token)) return
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
        }
      },
      onError: (msg) => {
        if (!sessionGuard.isCurrent(token)) return
        setErrorBanner(msg)
      },
      onRoomEnded: () => {
        if (webrtcRef.current !== rtc || !sessionGuard.isCurrent(token)) return
        const endedToken = sessionGuard.invalidate()
        ownsSessionRef.current = false
        webrtcRef.current = null
        setVideoCallState('idle')
        setStatus(ANONYMOUS_STATUS.ENDED)
        setMessages((prev) => sessionGuard.isCurrent(endedToken) ? [...prev, {
          id: createSysId('sys-disconnected'),
          is_system: true,
          content: 'Your partner has disconnected.',
        }] : prev)
      },
    })

    webrtcRef.current = rtc
  }, [sessionGuard])

  // ─── Matchmaking & Queue Handlers ───────────────────────────
  const acceptMatch = useCallback((data, token, restored = false) => {
    if (!sessionGuard.isCurrent(token) || !data?.matched || !data.room_id) return null
    // Claim the match once; overlapping polls for the waiting generation
    // cannot create another peer manager or restore an older room.
    const roomToken = sessionGuard.invalidate()
    clearQueueTimers()
    roomRef.current = data.room_id
    ownsSessionRef.current = true
    setRoomId(data.room_id)
    setMyAlias(data.my_alias || 'You')
    setPartnerAlias(data.partner_alias || 'Stranger')
    setStatus(ANONYMOUS_STATUS.CONNECTED)
    setSearching(false)
    setMessages((prev) => sessionGuard.isCurrent(roomToken) && roomRef.current === data.room_id ? [...prev, {
      id: createSysId(restored ? 'sys-restored' : 'sys-matched'),
      is_system: true,
      content: restored
        ? `Reconnected with ${data.partner_alias || 'Stranger'}.`
        : `Connected with ${data.partner_alias || 'Stranger'}! Say hello.`,
    }] : prev)
    initWebRTC(data.room_id, roomToken)
    return roomToken
  }, [sessionGuard, clearQueueTimers, initWebRTC])

  const startQueuePolling = useCallback((token) => {
    clearQueueTimers()
    heartbeatTimerRef.current = setInterval(async () => {
      if (!supabase || !sessionGuard.isCurrent(token)) return
      try {
        const accessToken = await getAnonymousAccessToken(supabase, userId)
        if (!sessionGuard.isCurrent(token)) return
        const { error } = await supabase.rpc('anonymous_heartbeat')
          .setHeader('Authorization', `Bearer ${accessToken}`)
        if (error && sessionGuard.isCurrent(token)) console.warn('Queue heartbeat error:', error.message)
      } catch (err) {
        if (sessionGuard.isCurrent(token)) console.warn('Queue heartbeat error:', err)
      }
    }, 15000)

    matchPollTimerRef.current = setInterval(async () => {
      if (!supabase || !sessionGuard.isCurrent(token)) return
      try {
        const accessToken = await getAnonymousAccessToken(supabase, userId)
        if (!sessionGuard.isCurrent(token)) return
        const { data, error } = await supabase.rpc('anonymous_check_match')
          .setHeader('Authorization', `Bearer ${accessToken}`)
        if (!sessionGuard.isCurrent(token)) return
        if (error) {
          console.warn('Check match error:', error.message)
          return
        }
        if (!data) return
        if (data.matched && data.room_id) {
          acceptMatch(data, token)
        } else if (data.status === 'idle') {
          sessionGuard.invalidate()
          clearQueueTimers()
          ownsSessionRef.current = false
          setSearching(false)
          setStatus(ANONYMOUS_STATUS.IDLE)
          setSystemNotice('Search ended. Start again when you are ready.')
        }
      } catch (err) {
        if (sessionGuard.isCurrent(token)) console.warn('Poll error:', err)
      }
    }, 2500)
  }, [userId, sessionGuard, clearQueueTimers, acceptMatch])

  const handleStartSearch = async () => {
    intentRef.current += 1
    if (!supabase || !userId) {
      setErrorBanner('Please sign in to access CampusAnonymous.')
      return
    }
    const operation = sessionGuard.beginJoin(async (token) => {
      await waitForAnonymousCleanup(userId)
      if (!sessionGuard.isCurrent(token)) return null
      const accessToken = await getAnonymousAccessToken(supabase, userId)
      if (!sessionGuard.isCurrent(token)) return null
      ownsSessionRef.current = true
      const { data, error } = await supabase.rpc('anonymous_join_or_match')
        .setHeader('Authorization', `Bearer ${accessToken}`)
      if (error) throw error
      return data
    })
    if (!operation) return

    roomRef.current = null
    setRoomId(null)
    setErrorBanner(null)
    setStopFailed(false)
    setReportModalOpen(false)
    setSubmittingReport(false)
    reportPendingRef.current = false
    setSystemNotice(null)
    setSearching(true)
    setStatus(ANONYMOUS_STATUS.WAITING)
    setMessages([{ id: createSysId('sys-searching'), is_system: true, content: 'Looking for someone to chat with...' }])
    setVideoCallState('idle')

    try {
      const data = await operation.task
      if (!sessionGuard.isCurrent(operation.token) || !data) return
      if (data.matched && data.room_id) acceptMatch(data, operation.token)
      else if (data.status === 'waiting') startQueuePolling(operation.token)
      else throw new Error('Unexpected matchmaking response.')
    } catch (err) {
      if (!sessionGuard.isCurrent(operation.token)) return
      console.error('Matchmaking error:', err)
      // A network failure does not prove the server failed to enqueue.
      ownsSessionRef.current = true
      setErrorBanner(`Could not confirm matchmaking: ${err.message || 'Please try again.'} Press Stop to clear any session.`)
      setStopFailed(true)
      setStatus(ANONYMOUS_STATUS.ENDED)
      setSearching(false)
    }
  }

  // Restore active room or resume queue on mount
  useEffect(() => {
    if (!supabase || !userId) return
    let isMounted = true
    const token = sessionGuard.current()

    ;(async () => {
      try {
        await waitForAnonymousCleanup(userId)
        if (!isMounted || !sessionGuard.isCurrent(token)) return
        const accessToken = await getAnonymousAccessToken(supabase, userId)
        if (!isMounted || !sessionGuard.isCurrent(token)) return
        const { data, error } = await supabase.rpc('anonymous_check_match')
          .setHeader('Authorization', `Bearer ${accessToken}`)
        if (!isMounted || !sessionGuard.isCurrent(token)) return
        if (error) throw error
        if (!data) return

        if (data.matched && data.room_id) {
          const roomToken = acceptMatch(data, token, true)
          if (roomToken === null) return
          try {
            const { data: histData, error: histErr } = await supabase.rpc('anonymous_get_messages', {
              p_room_id: data.room_id,
            })
            if (!histErr && Array.isArray(histData) && isMounted && sessionGuard.isCurrent(roomToken)) {
              setMessages((prev) => {
                if (!isMounted || !sessionGuard.isCurrent(roomToken) || roomRef.current !== data.room_id) return prev
                const ids = new Set(histData.map((message) => message.id))
                return [...histData, ...prev.filter((message) => !message.is_system && !ids.has(message.id))]
              })
            }
          } catch (e) {
            if (sessionGuard.isCurrent(roomToken)) console.warn('Could not restore message history:', e)
          }
        } else if (data.status === 'waiting' && isMounted) {
          ownsSessionRef.current = true
          setStatus(ANONYMOUS_STATUS.WAITING)
          setSearching(true)
          setMessages([
            {
              id: createSysId('sys-searching'),
              is_system: true,
              content: 'Looking for someone to chat with...',
            },
          ])
          startQueuePolling(token)
        }
      } catch (err) {
        if (isMounted && sessionGuard.isCurrent(token)) {
          setErrorBanner(`Could not verify the previous session: ${err.message || 'Please try again.'} Press Stop to retry cleanup.`)
          setStopFailed(true)
          setStatus(ANONYMOUS_STATUS.ENDED)
          ownsSessionRef.current = true
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [userId, sessionGuard, acceptMatch, startQueuePolling])

  const stopCurrentSession = () => {
    if (stopRequestRef.current) return stopRequestRef.current
    const previousRoom = roomRef.current
    const stop = sessionGuard.stop(async () => {
      if (ownsSessionRef.current) {
        if (!supabase || !userId) throw new Error('Your session is unavailable.')
        await leaveAnonymousSession(supabase, userId, previousRoom)
      }
    })
    const token = sessionGuard.current()
    clearQueueTimers()
    if (webrtcRef.current) {
      webrtcRef.current.destroy()
      webrtcRef.current = null
    }
    setVideoCallState('idle')
    setStopping(true)
    setSending(false)
    setReportModalOpen(false)
    setSubmittingReport(false)
    reportPendingRef.current = false
    const result = (async () => {
      try {
        await stop
        if (sessionGuard.isCurrent(token)) {
          if (userId) clearAnonymousCleanup(userId)
          ownsSessionRef.current = false
          setStopFailed(false)
          setSearching(false)
          setStatus(previousRoom ? ANONYMOUS_STATUS.ENDED : ANONYMOUS_STATUS.IDLE)
          setMessages((prev) => sessionGuard.isCurrent(token) ? [...prev, {
            id: createSysId('sys-ended'), is_system: true,
            content: previousRoom ? 'You have disconnected.' : 'Search cancelled.',
          }] : prev)
        }
        return true
      } catch (err) {
        if (sessionGuard.isCurrent(token)) {
          setStopFailed(true)
          setSearching(false)
          setStatus(ANONYMOUS_STATUS.ENDED)
          setErrorBanner(`Could not confirm the session ended: ${err.message || 'Please try again.'} Press Stop to retry.`)
        }
        return false
      } finally {
        if (sessionGuard.isCurrent(token)) setStopping(false)
      }
    })()
    stopRequestRef.current = result
    result.then(() => { if (stopRequestRef.current === result) stopRequestRef.current = null })
    return result
  }

  const handleStop = async () => {
    intentRef.current += 1
    await stopCurrentSession()
  }

  const handleNextPartner = async () => {
    const intent = ++intentRef.current
    const stopped = await stopCurrentSession()
    if (stopped && intentRef.current === intent && sessionGuard.isCurrent(sessionGuard.current())) {
      await handleStartSearch()
    }
  }

  // ─── Exit Immersive Mode Handler ────────────────────────────
  const handleExit = async () => {
    const intent = ++intentRef.current
    const stopped = await stopCurrentSession()
    if (!stopped || intentRef.current !== intent || !sessionGuard.isCurrent(sessionGuard.current())) return
    await exitBrowserFullscreen()
    if (intentRef.current !== intent || !sessionGuard.isCurrent(sessionGuard.current())) return
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  // Toggle native browser fullscreen
  const handleToggleFullscreen = async () => {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      await exitBrowserFullscreen()
    } else {
      await requestBrowserFullscreen()
    }
  }

  // ─── Realtime Subscriptions ─────────────────────────────────
  useEffect(() => {
    if (!supabase || !roomId || status !== ANONYMOUS_STATUS.CONNECTED) return
    const token = sessionGuard.current()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`anonymous-messages:${roomId}`)
      // Real-time chat messages delivered strictly from database CDC (postgres_changes)
      // Guarantees all messages are validated and rate-limited by the database server
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anonymous_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const msg = payload.new
          if (!sessionGuard.isCurrent(token) || roomRef.current !== roomId ||
              msg?.room_id !== roomId || !msg?.id || !msg?.content) return
          setMessages((prev) => {
            if (!sessionGuard.isCurrent(token) || roomRef.current !== roomId) return prev
            if (prev.some((m) => m.id === msg.id)) return prev
            const isSelf = myAlias && msg.sender_alias === myAlias
            return [
              ...prev,
              {
                id: msg.id,
                room_id: msg.room_id,
                content: msg.content,
                sender_alias: isSelf ? 'You' : msg.sender_alias || partnerAlias || 'Stranger',
                sender_role: msg.sender_role,
                is_self: isSelf,
                created_at: msg.created_at,
              },
            ]
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [roomId, status, partnerAlias, myAlias, sessionGuard])

  // ─── Message Transmission ───────────────────────────────────
  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!inputValue.trim() || sending || !roomId || stopRequestRef.current ||
        status !== ANONYMOUS_STATUS.CONNECTED) return

    const validation = validateAnonymousMessage(inputValue)
    if (!validation.isValid) {
      setErrorBanner(validation.error)
      return
    }

    setSending(true)
    setErrorBanner(null)
    const token = sessionGuard.current()
    const targetRoom = roomId

    try {
      const { data, error } = await supabase.rpc('anonymous_send_message', {
        p_room_id: targetRoom,
        p_content: validation.content,
      })

      if (!sessionGuard.isCurrent(token) || roomRef.current !== targetRoom) return
      if (error) throw error

      setInputValue('')
      if (data?.id) {
        setMessages((prev) => {
          if (!sessionGuard.isCurrent(token) || roomRef.current !== targetRoom) return prev
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, data]
        })
      }
    } catch (err) {
      if (!sessionGuard.isCurrent(token) || roomRef.current !== targetRoom) return
      console.error('Send message error:', err)
      if (err.message?.includes('already ended') || err.message?.includes('not found')) {
        const endedToken = sessionGuard.invalidate()
        ownsSessionRef.current = false
        setSending(false)
        if (webrtcRef.current) {
          webrtcRef.current.destroy()
          webrtcRef.current = null
        }
        setVideoCallState('idle')
        setStatus(ANONYMOUS_STATUS.ENDED)
        setMessages((prev) => sessionGuard.isCurrent(endedToken) ? [
          ...prev,
          {
            id: createSysId('sys-disconnected'),
            is_system: true,
            content: `${partnerAlias || 'Stranger'} has disconnected.`,
          },
        ] : prev)
      } else {
        setErrorBanner(`Failed to send: ${err.message || 'Please check your connection.'}`)
      }
    } finally {
      if (sessionGuard.isCurrent(token) && roomRef.current === targetRoom) setSending(false)
    }
  }

  // ─── Safety: Block & Report ─────────────────────────────────
  const handleBlockPartner = async () => {
    if (stopRequestRef.current) return
    if (!window.confirm(`Block ${partnerAlias || 'this partner'}? You will not be matched together again.`)) {
      return
    }

    if (!supabase || !roomId) return
    const token = sessionGuard.current()
    const targetRoom = roomId

    try {
      const { data, error } = await supabase.rpc('anonymous_block_partner', { p_room_id: targetRoom })
      if (!sessionGuard.isCurrent(token) || roomRef.current !== targetRoom) return
      if (error) throw error
      if (data !== true) throw new Error('The server did not confirm the block.')

      const endedToken = sessionGuard.invalidate()
      ownsSessionRef.current = false
      setSending(false)
      if (webrtcRef.current) {
        webrtcRef.current.destroy()
        webrtcRef.current = null
      }
      setStatus(ANONYMOUS_STATUS.ENDED)
      setMessages((prev) => sessionGuard.isCurrent(endedToken) ? [
        ...prev,
        {
          id: createSysId('sys-blocked'),
          is_system: true,
          content: `${partnerAlias || 'Partner'} blocked. You will never be matched together again.`,
        },
      ] : prev)
    } catch (err) {
      if (!sessionGuard.isCurrent(token) || roomRef.current !== targetRoom) return
      console.error('Block error:', err)
      setErrorBanner(`Could not block user: ${err.message || 'Please try again.'}`)
    }
  }

  const handleOpenReportModal = () => {
    if (stopRequestRef.current) return
    setReportReason(REPORT_REASONS[0])
    const lastMsg = messages.filter((m) => !m.is_system).pop()?.content || ''
    setReportSnippet(lastMsg)
    setReportModalOpen(true)
  }

  const handleSubmitReport = async (e) => {
    e.preventDefault()
    if (!supabase || !roomId || stopRequestRef.current || reportPendingRef.current) return

    const validation = validateAnonymousReport(reportReason, reportSnippet)
    if (!validation.isValid) {
      setErrorBanner(validation.error)
      return
    }

    reportPendingRef.current = true
    setSubmittingReport(true)
    setErrorBanner(null)
    const targetRoom = roomId
    const intent = intentRef.current
    // A room-end notification may arrive before this response. Keep the
    // result only while the same page intent and room are still current.
    const isCurrentReport = () => intentRef.current === intent &&
      roomRef.current === targetRoom && sessionGuard.isCurrent(sessionGuard.current())

    try {
      const { data, error } = await supabase.rpc('anonymous_report_partner', {
        p_room_id: targetRoom,
        p_reason: validation.reason,
        p_snippet: validation.snippet,
      })
      if (!isCurrentReport()) return
      if (error) throw error
      if (!data) throw new Error('The server did not confirm the report.')

      const endedToken = sessionGuard.invalidate()
      ownsSessionRef.current = false
      setSending(false)
      setReportModalOpen(false)
      if (webrtcRef.current) {
        webrtcRef.current.destroy()
        webrtcRef.current = null
      }
      setStatus(ANONYMOUS_STATUS.ENDED)
      setMessages((prev) => sessionGuard.isCurrent(endedToken) ? [
        ...prev,
        {
          id: createSysId('sys-reported'),
          is_system: true,
          content: 'Report submitted for review. Partner has been blocked.',
        },
      ] : prev)
    } catch (err) {
      if (!isCurrentReport()) return
      console.error('Report submission error:', err)
      setErrorBanner(`Could not confirm the report: ${err.message || 'Please try again.'}`)
    } finally {
      if (isCurrentReport()) {
        reportPendingRef.current = false
        setSubmittingReport(false)
      }
    }
  }

  // ─── Video Call Controls ────────────────────────────────────
  const handleToggleCamera = () => {
    if (!webrtcRef.current) return
    const next = !cameraActive
    setCameraActive(next)
    webrtcRef.current.toggleCamera(next)
  }

  const handleToggleMic = () => {
    if (!webrtcRef.current) return
    const next = !micActive
    setMicActive(next)
    webrtcRef.current.toggleMic(next)
  }

  // ─── Status Text & Dot Helper ───────────────────────────────
  const getStatusDisplay = () => {
    if (status === ANONYMOUS_STATUS.CONNECTED) {
      return {
        text: `Connected with ${partnerAlias || 'Stranger'}`,
        dotClass: 'bg-emerald-500',
        textColor: 'text-emerald-700 dark:text-emerald-400 font-semibold',
      }
    }
    if (status === ANONYMOUS_STATUS.WAITING) {
      return {
        text: 'Looking for a campus peer...',
        dotClass: 'bg-amber-500 animate-pulse',
        textColor: 'text-amber-700 dark:text-amber-400 font-semibold',
      }
    }
    if (status === ANONYMOUS_STATUS.ENDED) {
      return {
        text: 'Chat ended',
        dotClass: 'bg-rose-500',
        textColor: 'text-rose-600 dark:text-rose-400 font-semibold',
      }
    }
    return {
      text: 'Ready to start',
      dotClass: 'bg-gray-400 dark:bg-gray-500',
      textColor: 'text-[var(--cm-muted)]',
    }
  }

  const statusInfo = getStatusDisplay()

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col bg-[var(--cm-bg)] text-[var(--cm-text)] overflow-hidden p-2 sm:p-3 select-none">
      {/* ─── Minimal Header Bar with Exit & Fullscreen Controls ─ */}
      <header className="flex shrink-0 items-center justify-between border-b-2 border-[var(--cm-border)] pb-2 mb-2">
        <div className="flex items-center gap-2.5">
          {/* Clearly Visible Exit Button */}
          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1.5 border-2 border-[var(--cm-border)] bg-[var(--cm-surface)] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--cm-text)] shadow-[2px_2px_0px_var(--cm-border)] hover:bg-[var(--cm-secondary)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none select-none transition-none"
            title="Exit Anonymous Mode & Return to CampusMate"
            aria-label="Exit Anonymous Mode"
          >
            <ArrowLeft size={14} />
            <span>Exit</span>
          </button>

          <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--cm-text)]">
            CampusAnonymous
          </span>
          <span className="hidden sm:inline text-xs text-[var(--cm-muted)]">
            talk to a campus peer
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-300">
            <Lock size={10} /> Alias-based chat
          </span>
        </div>

        {/* Status Indicator & Fullscreen Controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="hidden sm:flex items-center gap-1 border border-[var(--cm-border)] bg-[var(--cm-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] select-none"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
            <span className="hidden md:inline">{isFullscreen ? 'Windowed' : 'Fullscreen'}</span>
          </button>

          <span className={`inline-block h-2 w-2 rounded-full ${statusInfo.dotClass}`} />
          <span className={statusInfo.textColor}>{statusInfo.text}</span>
        </div>
      </header>

      {/* ─── Permission / Error Banner ────────────────────────── */}
      {errorBanner && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between border-2 border-rose-600 bg-rose-50 dark:bg-rose-950/60 p-2 mb-2 text-xs text-rose-800 dark:text-rose-200 font-medium"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-600" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="p-1 hover:bg-rose-200/50 dark:hover:bg-rose-800/50"
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── Main Workspace: 38% Video Column / 62% Chat Column ── */}
      <div className="flex flex-1 flex-col md:flex-row gap-2 min-h-0">
        {/* ─── Left: Permanent Two-Box Video Stage (38%) ──────── */}
        <div className="flex md:w-[38%] flex-row md:flex-col gap-2 shrink-0 md:h-full max-h-[30vh] md:max-h-none">
          {/* Box 1: Stranger Video (taller, flex 1.35 on desktop) */}
          <div className="relative flex-1 md:flex-[1.35] bg-[#1a1a1a] border-2 border-[var(--cm-border)] overflow-hidden flex items-center justify-center min-h-0">
            {/* Tag Badge */}
            <span className="absolute top-2 left-2 z-10 bg-black/70 border border-white/20 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              {partnerAlias ? `stranger: ${partnerAlias}` : 'stranger'}
            </span>

            {/* Video element */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`h-full w-full object-cover ${videoCallState === 'connected' ? 'block' : 'hidden'}`}
            />

            {/* Video Placeholder States */}
            {videoCallState !== 'connected' && (
              <div className="flex flex-col items-center justify-center p-4 text-center text-gray-400">
                {status === ANONYMOUS_STATUS.WAITING && (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={24} className="animate-spin text-amber-400" />
                    <p className="text-xs">Finding someone online...</p>
                  </div>
                )}

                {status === ANONYMOUS_STATUS.CONNECTED && (
                  <div className="flex flex-col items-center gap-2">
                    {videoCallState === 'idle' && (
                      <>
                        <Ghost size={28} className="opacity-40" />
                        <p className="text-xs">Video disabled (Text active)</p>
                        <button
                          type="button"
                          onClick={() => webrtcRef.current?.requestCall()}
                          className="mt-1 flex items-center gap-1.5 rounded bg-purple-600 px-3 py-1 text-xs font-bold text-white shadow hover:bg-purple-700"
                        >
                          <Video size={13} />
                          <span>Request Video Call</span>
                        </button>
                      </>
                    )}

                    {videoCallState === 'requesting' && (
                      <div className="flex flex-col items-center gap-1.5">
                        <Loader2 size={20} className="animate-spin text-purple-400" />
                        <p className="text-xs text-purple-300">
                          Waiting for partner to accept video...
                        </p>
                      </div>
                    )}

                    {videoCallState === 'incoming_request' && (
                      <div className="flex flex-col items-center gap-2 bg-black/60 p-2.5 rounded border border-purple-500/50">
                        <p className="text-xs font-bold text-white">
                          Partner requested video call!
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => webrtcRef.current?.acceptCall()}
                            className="bg-emerald-600 px-3 py-1 text-xs font-bold text-white rounded hover:bg-emerald-700"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => webrtcRef.current?.rejectCall()}
                            className="border border-gray-400 bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-200 rounded hover:bg-gray-700"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}

                    {videoCallState === 'connecting' && (
                      <div className="flex flex-col items-center gap-1.5">
                        <Loader2 size={20} className="animate-spin text-emerald-400" />
                        <p className="text-xs text-emerald-300">Connecting video stream...</p>
                      </div>
                    )}
                  </div>
                )}

                {(status === ANONYMOUS_STATUS.IDLE || status === ANONYMOUS_STATUS.ENDED) && (
                  <div className="flex flex-col items-center gap-1.5">
                    <Ghost size={32} className="opacity-30" />
                    <p className="text-xs font-medium">No partner connected</p>
                    <p className="text-[10px] text-gray-500">Click Start below to begin</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Box 2: Your Video (flex 0.85 on desktop) */}
          <div className="relative flex-1 md:flex-[0.85] bg-[#222] border-2 border-[var(--cm-border)] overflow-hidden flex items-center justify-center min-h-0">
            {/* Tag Badge */}
            <span className="absolute top-2 left-2 z-10 bg-black/70 border border-white/20 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              {myAlias ? `you: ${myAlias}` : 'you'}
            </span>

            {/* Local Video mirrored */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover -scale-x-100 ${videoCallState === 'connected' ? 'block' : 'hidden'}`}
            />

            {/* Video Placeholder */}
            {videoCallState !== 'connected' && (
              <div className="text-center text-gray-400 p-2">
                <p className="text-xs">Camera off</p>
                <p className="text-[10px] text-gray-500">Active only during accepted video calls</p>
              </div>
            )}

            {/* Mini tactile cam controls anchored in bottom right */}
            <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5">
              {['requesting', 'connecting', 'connected'].includes(videoCallState) && (
                <button
                  type="button"
                  onClick={() => webrtcRef.current?.endCall()}
                  className="border border-rose-700 bg-rose-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-800"
                  title="End video without ending chat"
                >
                  End video
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleMic}
                disabled={videoCallState !== 'connected'}
                className={`border border-[#333] px-2 py-1 text-[11px] font-bold text-white shadow-xs transition-none disabled:opacity-40 disabled:cursor-not-allowed ${
                  !micActive ? 'bg-rose-600' : 'bg-black/80 hover:bg-black'
                }`}
                title={micActive ? 'Mute microphone' : 'Unmute microphone'}
              >
                {micActive ? <Mic size={12} /> : <MicOff size={12} />}
              </button>

              <button
                type="button"
                onClick={handleToggleCamera}
                disabled={videoCallState !== 'connected'}
                className={`border border-[#333] px-2 py-1 text-[11px] font-bold text-white shadow-xs transition-none disabled:opacity-40 disabled:cursor-not-allowed ${
                  !cameraActive ? 'bg-rose-600' : 'bg-black/80 hover:bg-black'
                }`}
                title={cameraActive ? 'Turn off camera' : 'Turn on camera'}
              >
                {cameraActive ? <Video size={12} /> : <VideoOff size={12} />}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Right: Chat Panel (62%) ────────────────────────── */}
        <div className="flex flex-1 flex-col border-2 border-[var(--cm-border)] bg-[var(--cm-surface)] min-w-0 min-h-0">
          {/* Subbar: Chat Header & Safety Actions */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--cm-border)] bg-[var(--cm-secondary)] px-3 py-1.5 text-xs text-[var(--cm-muted)]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--cm-text)]">chat</span>
              {status === ANONYMOUS_STATUS.CONNECTED && (
                <span className="text-[11px] text-[var(--cm-muted)]">
                  (talking with <strong className="text-[var(--cm-text)]">{partnerAlias}</strong>)
                </span>
              )}
            </div>

            {/* Keep reporting available after the other participant leaves. */}
            {roomId && (status === ANONYMOUS_STATUS.CONNECTED || status === ANONYMOUS_STATUS.ENDED) && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleBlockPartner}
                  disabled={stopping}
                  className="flex items-center gap-1 border border-[var(--cm-border)] bg-[var(--cm-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--cm-text)] hover:bg-rose-500 hover:text-white dark:hover:bg-rose-700"
                  title="Block partner"
                >
                  <UserX size={12} />
                  <span>Block</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenReportModal}
                  disabled={stopping}
                  className="flex items-center gap-1 border border-[var(--cm-border)] bg-[var(--cm-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--cm-text)] hover:bg-amber-500 hover:text-white dark:hover:bg-amber-700"
                  title="Report partner"
                >
                  <Flag size={12} />
                  <span>Report</span>
                </button>
              </div>
            )}
          </div>

          {/* Messages Stream (Inline Dialogue Style) */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5 font-sans text-sm min-h-0 bg-[var(--cm-surface)]">
            {messages.length === 0 && (
              <div className="text-center py-10 text-xs text-[var(--cm-muted)]">
                <p className="font-bold text-sm text-[var(--cm-text)]">CampusAnonymous Chat</p>
                <p className="mt-1">
                  Click <strong>Start</strong> below to connect with a random campus peer.
                </p>
                <p className="mt-0.5 text-[11px]">
                  Real names and emails are not shared with your chat partner. Messages are retained for safety review.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              if (msg.is_system) {
                return (
                  <div key={msg.id} className="text-xs italic text-[var(--cm-muted)] py-0.5">
                    * {msg.content}
                  </div>
                )
              }

              const isSelf = msg.is_self
              return (
                <div key={msg.id} className="break-words leading-relaxed text-sm">
                  <span
                    className={`font-bold mr-1.5 ${
                      isSelf
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isSelf ? 'You' : msg.sender_alias || partnerAlias || 'Stranger'}:
                  </span>
                  <span className="text-[var(--cm-text)] whitespace-pre-wrap">{msg.content}</span>
                  {msg.created_at && (
                    <span className="ml-2 text-[10px] text-[var(--cm-muted)] select-none">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Tactile Control Dock */}
          <div className="border-t-2 border-[var(--cm-border)] bg-[var(--cm-secondary)] p-2 flex flex-col sm:flex-row gap-2 shrink-0">
            {/* Primary Action Buttons: Start, Next, Stop */}
            <div className="flex gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleStartSearch}
                disabled={
                  searching || stopping || stopFailed ||
                  (status !== ANONYMOUS_STATUS.IDLE && status !== ANONYMOUS_STATUS.ENDED)
                }
                className={`border-2 border-[var(--cm-border)] px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--cm-border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none select-none disabled:opacity-40 disabled:cursor-not-allowed ${
                  status === ANONYMOUS_STATUS.IDLE || status === ANONYMOUS_STATUS.ENDED
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600'
                    : 'bg-[var(--cm-surface)] text-[var(--cm-muted)]'
                }`}
              >
                Start
              </button>

              <button
                type="button"
                onClick={handleNextPartner}
                disabled={stopping || stopFailed || (status !== ANONYMOUS_STATUS.CONNECTED && status !== ANONYMOUS_STATUS.WAITING)}
                className={`border-2 border-[var(--cm-border)] px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--cm-border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none select-none disabled:opacity-40 disabled:cursor-not-allowed ${
                  status === ANONYMOUS_STATUS.CONNECTED || status === ANONYMOUS_STATUS.WAITING
                    ? 'bg-amber-400 text-gray-950 hover:bg-amber-500 dark:bg-amber-500'
                    : 'bg-[var(--cm-surface)] text-[var(--cm-muted)]'
                }`}
              >
                Next
              </button>

              <button
                type="button"
                onClick={handleStop}
                disabled={stopping || (!stopFailed && status !== ANONYMOUS_STATUS.CONNECTED && status !== ANONYMOUS_STATUS.WAITING)}
                className={`border-2 border-[var(--cm-border)] px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--cm-border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none select-none disabled:opacity-40 disabled:cursor-not-allowed ${
                  status === ANONYMOUS_STATUS.CONNECTED || status === ANONYMOUS_STATUS.WAITING
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-[var(--cm-surface)] text-[var(--cm-muted)]'
                }`}
              >
                {stopping ? 'Stopping...' : stopFailed ? 'Retry Stop' : 'Stop'}
              </button>
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendMessage} className="flex flex-1 gap-1.5 min-w-0">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  status === ANONYMOUS_STATUS.CONNECTED
                    ? 'type a message and hit enter...'
                    : status === ANONYMOUS_STATUS.WAITING
                      ? 'searching for a partner...'
                      : 'click Start to begin chatting...'
                }
                maxLength={1000}
                disabled={stopping || status !== ANONYMOUS_STATUS.CONNECTED || sending}
                className="flex-1 border-2 border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-1.5 text-sm text-[var(--cm-text)] outline-none min-w-0 focus:border-[var(--cm-accent)] disabled:opacity-50 disabled:bg-[var(--cm-bg)]"
              />
              <button
                type="submit"
                disabled={stopping || !inputValue.trim() || sending || status !== ANONYMOUS_STATUS.CONNECTED}
                className="border-2 border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--cm-border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none select-none text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ─── Report Modal ─────────────────────────────────────── */}
      {reportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
        >
          <div className="relative w-full max-w-md border-2 border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setReportModalOpen(false)}
              className="absolute right-4 top-4 p-1 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-rose-600">
              <Flag size={20} />
              <h2 id="report-modal-title" className="text-base font-bold text-[var(--cm-text)]">
                Report {partnerAlias || 'Stranger'}
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--cm-muted)]">
              Submitting a report ends the chat and blocks this student from ever matching with you again.
            </p>

            <form onSubmit={handleSubmitReport} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                  Reason for Report *
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="mt-1 w-full border-2 border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-sm text-[var(--cm-text)] outline-none"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                  Evidence Snippet (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reportSnippet}
                  onChange={(e) => setReportSnippet(e.target.value)}
                  placeholder="Paste problematic messages or describe behavior..."
                  maxLength={500}
                  className="mt-1 w-full border-2 border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-xs text-[var(--cm-text)] outline-none"
                />
                <span className="text-[10px] text-[var(--cm-muted)]">
                  {reportSnippet.length} / 500 characters
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  disabled={submittingReport}
                  className="border-2 border-[var(--cm-border)] px-4 py-2 text-xs font-semibold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport || stopping}
                  className="border-2 border-rose-700 bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report & Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
