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

// Helper to generate unique keys for ephemeral system notes
let sysMsgCounter = 0
const createSysId = (prefix) => `${prefix}-${++sysMsgCounter}`

export default function Anonymous() {
  const { user } = useAuth()
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

  // Cleanup on unmount or page exit
  useEffect(() => {
    return () => {
      clearInterval(heartbeatTimerRef.current)
      clearInterval(matchPollTimerRef.current)
      if (webrtcRef.current) {
        webrtcRef.current.destroy()
        webrtcRef.current = null
      }
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (supabase && user?.id) {
        ;(async () => {
          try {
            const { error } = await supabase.rpc('anonymous_leave')
            if (error) {
              console.warn('Cleanup leave error:', error.message)
            }
          } catch (err) {
            console.warn('Cleanup leave error:', err)
          }
        })()
      }
    }
  }, [user?.id])

  // ─── WebRTC Setup ───────────────────────────────────────────
  const initWebRTC = useCallback((activeRoomId) => {
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
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
        }
      },
      onError: (msg) => {
        setErrorBanner(msg)
      },
      onRoomEnded: () => {
        if (webrtcRef.current !== rtc) return
        webrtcRef.current = null
        setVideoCallState('idle')
        setStatus(ANONYMOUS_STATUS.ENDED)
        setMessages((prev) => [...prev, {
          id: createSysId('sys-disconnected'),
          is_system: true,
          content: 'Your partner has disconnected.',
        }])
      },
    })

    webrtcRef.current = rtc
  }, [])

  // ─── Matchmaking & Queue Handlers ───────────────────────────
  const handleStartSearch = async () => {
    if (!supabase || !user?.id) {
      setErrorBanner('Please sign in to access CampusAnonymous.')
      return
    }

    setErrorBanner(null)
    setSystemNotice(null)
    setSearching(true)
    setStatus(ANONYMOUS_STATUS.WAITING)
    setMessages([
      {
        id: createSysId('sys-searching'),
        is_system: true,
        content: 'Looking for someone to chat with...',
      },
    ])
    setRoomId(null)
    setVideoCallState('idle')

    try {
      const { data, error } = await supabase.rpc('anonymous_join_or_match')
      if (error) throw error

      if (data?.matched && data.room_id) {
        // Matched immediately with waiting peer!
        setRoomId(data.room_id)
        setMyAlias(data.my_alias || 'You')
        setPartnerAlias(data.partner_alias || 'Stranger')
        setStatus(ANONYMOUS_STATUS.CONNECTED)
        setSearching(false)
        setMessages((prev) => [
          ...prev,
          {
            id: createSysId('sys-matched'),
            is_system: true,
            content: `Connected with ${data.partner_alias}! Say hello.`,
          },
        ])
        initWebRTC(data.room_id)
      } else {
        // Enqueued; start heartbeat and polling
        startQueuePolling()
      }
    } catch (err) {
      console.error('Matchmaking error:', err)
      setErrorBanner(`Matchmaking failed: ${err.message || 'Please try again.'}`)
      setStatus(ANONYMOUS_STATUS.IDLE)
      setSearching(false)
      setMessages([])
    }
  }

  // Poll for match while in queue
  const startQueuePolling = useCallback(() => {
    clearInterval(heartbeatTimerRef.current)
    clearInterval(matchPollTimerRef.current)

    // Heartbeat every 15 seconds
    heartbeatTimerRef.current = setInterval(async () => {
      if (!supabase) return
      try {
        const { error } = await supabase.rpc('anonymous_heartbeat')
        if (error) {
          console.warn('Queue heartbeat error:', error.message)
        }
      } catch (err) {
        console.warn('Queue heartbeat error:', err)
      }
    }, 15000)

    // Check match status every 2.5 seconds
    matchPollTimerRef.current = setInterval(async () => {
      if (!supabase) return
      try {
        const { data, error } = await supabase.rpc('anonymous_check_match')
        if (error) {
          console.warn('Check match error:', error.message)
          return
        }
        if (!data) return

        if (data.matched && data.room_id) {
          clearInterval(heartbeatTimerRef.current)
          clearInterval(matchPollTimerRef.current)

          setRoomId(data.room_id)
          setMyAlias(data.my_alias || 'You')
          setPartnerAlias(data.partner_alias || 'Stranger')
          setStatus(ANONYMOUS_STATUS.CONNECTED)
          setSearching(false)
          setMessages((prev) => [
            ...prev,
            {
              id: createSysId('sys-connected'),
              is_system: true,
              content: `Connected with ${data.partner_alias}! Say hello.`,
            },
          ])
          initWebRTC(data.room_id)
        }
      } catch (err) {
        console.warn('Poll error:', err)
      }
    }, 2500)
  }, [initWebRTC])

  // Restore active room or resume queue on mount
  useEffect(() => {
    if (!supabase || !user?.id) return
    let isMounted = true

    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('anonymous_check_match')
        if (error || !isMounted || !data) return

        if (data.matched && data.room_id) {
          setRoomId(data.room_id)
          setMyAlias(data.my_alias || 'You')
          setPartnerAlias(data.partner_alias || 'Stranger')
          setStatus(ANONYMOUS_STATUS.CONNECTED)

          // Hydrate message history for active room
          try {
            const { data: histData, error: histErr } = await supabase.rpc('anonymous_get_messages', {
              p_room_id: data.room_id,
            })
            if (!histErr && Array.isArray(histData) && isMounted && histData.length > 0) {
              setMessages(histData)
            } else if (isMounted) {
              setMessages([
                {
                  id: createSysId('sys-restored'),
                  is_system: true,
                  content: `Reconnected with ${data.partner_alias || 'Stranger'}.`,
                },
              ])
            }
          } catch (e) {
            console.warn('Could not restore message history:', e)
          }

          if (isMounted) {
            initWebRTC(data.room_id)
          }
        } else if (data.status === 'waiting' && isMounted) {
          setStatus(ANONYMOUS_STATUS.WAITING)
          setSearching(true)
          setMessages([
            {
              id: createSysId('sys-searching'),
              is_system: true,
              content: 'Looking for someone to chat with...',
            },
          ])
          startQueuePolling()
        }
      } catch (err) {
        console.warn('Session hydration error:', err)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [user?.id, initWebRTC, startQueuePolling])

  const handleCancelSearch = async () => {
    clearInterval(heartbeatTimerRef.current)
    clearInterval(matchPollTimerRef.current)
    setSearching(false)
    setStatus(ANONYMOUS_STATUS.IDLE)
    setMessages((prev) => [
      ...prev,
      {
        id: createSysId('sys-cancelled'),
        is_system: true,
        content: 'Search cancelled.',
      },
    ])

    if (supabase) {
      try {
        const { error } = await supabase.rpc('anonymous_leave')
        if (error) {
          console.warn('Cancel queue error:', error.message)
        }
      } catch (err) {
        console.warn('Cancel queue error:', err)
      }
    }
  }

  const handleEndChat = async () => {
    if (webrtcRef.current) {
      webrtcRef.current.destroy()
      webrtcRef.current = null
    }
    setVideoCallState('idle')

    if (supabase && roomId) {
      try {
        const { error } = await supabase.rpc('anonymous_leave', { p_room_id: roomId })
        if (error) {
          console.warn('Leave room error:', error.message)
        }
      } catch (err) {
        console.warn('Leave room error:', err)
      }
    }

    setStatus(ANONYMOUS_STATUS.ENDED)
    setMessages((prev) => [
      ...prev,
      {
        id: createSysId('sys-ended'),
        is_system: true,
        content: 'You have disconnected.',
      },
    ])
  }

  const handleNextPartner = async () => {
    await handleEndChat()
    await handleStartSearch()
  }

  // ─── Exit Immersive Mode Handler ────────────────────────────
  const handleExit = async () => {
    // 1. Exit native browser fullscreen if active
    await exitBrowserFullscreen()

    // 2. Clean up active chat or queue session
    if (status === ANONYMOUS_STATUS.CONNECTED) {
      await handleEndChat()
    } else if (status === ANONYMOUS_STATUS.WAITING) {
      await handleCancelSearch()
    }

    // 3. Return to previous page in history, or fallback to Dashboard
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
          if (!msg?.id || !msg?.content) return
          setMessages((prev) => {
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
      channelRef.current = null
    }
  }, [roomId, status, partnerAlias, myAlias])

  // ─── Message Transmission ───────────────────────────────────
  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!inputValue.trim() || sending || !roomId || status !== ANONYMOUS_STATUS.CONNECTED) return

    const validation = validateAnonymousMessage(inputValue)
    if (!validation.isValid) {
      setErrorBanner(validation.error)
      return
    }

    setSending(true)
    setErrorBanner(null)

    try {
      const { data, error } = await supabase.rpc('anonymous_send_message', {
        p_room_id: roomId,
        p_content: validation.content,
      })

      if (error) throw error

      setInputValue('')
      if (data?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, data]
        })
      }
    } catch (err) {
      console.error('Send message error:', err)
      if (err.message?.includes('already ended') || err.message?.includes('not found')) {
        setStatus(ANONYMOUS_STATUS.ENDED)
        setMessages((prev) => [
          ...prev,
          {
            id: createSysId('sys-disconnected'),
            is_system: true,
            content: `${partnerAlias || 'Stranger'} has disconnected.`,
          },
        ])
      } else {
        setErrorBanner(`Failed to send: ${err.message || 'Please check your connection.'}`)
      }
    } finally {
      setSending(false)
    }
  }

  // ─── Safety: Block & Report ─────────────────────────────────
  const handleBlockPartner = async () => {
    if (!window.confirm(`Block ${partnerAlias || 'this partner'}? You will not be matched together again.`)) {
      return
    }

    if (!supabase || !roomId) return

    try {
      const { error } = await supabase.rpc('anonymous_block_partner', { p_room_id: roomId })
      if (error) throw error

      if (webrtcRef.current) {
        webrtcRef.current.destroy()
        webrtcRef.current = null
      }
      setStatus(ANONYMOUS_STATUS.ENDED)
      setMessages((prev) => [
        ...prev,
        {
          id: createSysId('sys-blocked'),
          is_system: true,
          content: `${partnerAlias || 'Partner'} blocked. You will never be matched together again.`,
        },
      ])
    } catch (err) {
      console.error('Block error:', err)
      setErrorBanner(`Could not block user: ${err.message || 'Please try again.'}`)
    }
  }

  const handleOpenReportModal = () => {
    setReportReason(REPORT_REASONS[0])
    const lastMsg = messages.filter((m) => !m.is_system).pop()?.content || ''
    setReportSnippet(lastMsg)
    setReportModalOpen(true)
  }

  const handleSubmitReport = async (e) => {
    e.preventDefault()
    if (!supabase || !roomId) return

    const validation = validateAnonymousReport(reportReason, reportSnippet)
    if (!validation.isValid) {
      setErrorBanner(validation.error)
      return
    }

    setSubmittingReport(true)
    setErrorBanner(null)

    try {
      const { error } = await supabase.rpc('anonymous_report_partner', {
        p_room_id: roomId,
        p_reason: validation.reason,
        p_snippet: validation.snippet,
      })
      if (error) throw error

      setReportModalOpen(false)
      if (webrtcRef.current) {
        webrtcRef.current.destroy()
        webrtcRef.current = null
      }
      setStatus(ANONYMOUS_STATUS.ENDED)
      setMessages((prev) => [
        ...prev,
        {
          id: createSysId('sys-reported'),
          is_system: true,
          content: 'Report submitted for review. Partner has been blocked.',
        },
      ])
    } catch (err) {
      console.error('Report submission error:', err)
      setErrorBanner(`Failed to submit report: ${err.message || 'Please try again.'}`)
    } finally {
      setSubmittingReport(false)
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
                  className="flex items-center gap-1 border border-[var(--cm-border)] bg-[var(--cm-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--cm-text)] hover:bg-rose-500 hover:text-white dark:hover:bg-rose-700"
                  title="Block partner"
                >
                  <UserX size={12} />
                  <span>Block</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenReportModal}
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
                  searching ||
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
                disabled={status !== ANONYMOUS_STATUS.CONNECTED && status !== ANONYMOUS_STATUS.WAITING}
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
                onClick={status === ANONYMOUS_STATUS.WAITING ? handleCancelSearch : handleEndChat}
                disabled={status !== ANONYMOUS_STATUS.CONNECTED && status !== ANONYMOUS_STATUS.WAITING}
                className={`border-2 border-[var(--cm-border)] px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_var(--cm-border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none select-none disabled:opacity-40 disabled:cursor-not-allowed ${
                  status === ANONYMOUS_STATUS.CONNECTED || status === ANONYMOUS_STATUS.WAITING
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-[var(--cm-surface)] text-[var(--cm-muted)]'
                }`}
              >
                Stop
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
                disabled={status !== ANONYMOUS_STATUS.CONNECTED || sending}
                className="flex-1 border-2 border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-1.5 text-sm text-[var(--cm-text)] outline-none min-w-0 focus:border-[var(--cm-accent)] disabled:opacity-50 disabled:bg-[var(--cm-bg)]"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || sending || status !== ANONYMOUS_STATUS.CONNECTED}
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
                  disabled={submittingReport}
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
