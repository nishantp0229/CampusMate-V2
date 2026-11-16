import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Ban, Check, Flag, Hash, Loader2, MessageCircle, Pencil, Reply, Send, Trash2, Users, X,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import CommunityFriends from '../components/CommunityFriends'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { COMMUNITY_PAGE_SIZE, communityCursorFilter, mergeCommunityMessages } from '../lib/community'

const CHANNEL_ORDER = ['general', 'academics', 'coding', 'hackathons', 'campus-events']
const FIELD = 'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-2 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-none'

// The SDK reuses channels by topic, so finish leaving before rejoining it.
let communityChannelRemoval = Promise.resolve('ok')

async function fetchHistory(target, cursor = null) {
  const isPublic = target.kind === 'channel'
  let query = supabase
    .from(isPublic ? 'community_messages' : 'community_direct_messages')
    .select(isPublic
      ? 'id, channel_slug, sender_id, sender_name, content, reply_to, created_at, edited_at, deleted_at'
      : 'id, conversation_id, sender_id, content, created_at')
    .eq(isPublic ? 'channel_slug' : 'conversation_id', target.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(COMMUNITY_PAGE_SIZE)
  if (cursor) query = query.or(communityCursorFilter(cursor))
  const { data, error } = await query
  if (error) throw error
  return data || []
}

const timeLabel = (value) => new Date(value).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
})

function MessageRow({ message, isPublic, mine, isAdmin, peerName, messages, onReply, onEdit, onDelete, onReport, onBlock }) {
  const deleted = Boolean(message.deleted_at)
  const repliedTo = isPublic && message.reply_to && messages.find((item) => item.id === message.reply_to)

  return (
    <article className="group border-b border-[var(--cm-border)]/60 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-bold text-[var(--cm-text)]">
          {isPublic ? message.sender_name : mine ? 'You' : peerName || 'Student'}
        </span>
        <time dateTime={message.created_at} className="text-[10px] text-[var(--cm-muted)]">
          {timeLabel(message.created_at)}
        </time>
        {message.edited_at && <span className="text-[10px] text-[var(--cm-muted)]">edited</span>}
      </div>
      {message.reply_to && (
        <p className="mt-2 border-l-2 border-[var(--cm-accent)] pl-2 text-[11px] text-[var(--cm-muted)]">
          Replying to {repliedTo ? `${repliedTo.sender_name}: ${repliedTo.content || 'message removed'}` : 'an earlier message'}
        </p>
      )}
      <p className={`mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed ${deleted ? 'italic text-[var(--cm-muted)]' : 'text-[var(--cm-text)]'}`}>
        {deleted ? 'Message removed' : message.content}
      </p>
      {!deleted && (
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-[var(--cm-muted)]">
          {isPublic && <button type="button" onClick={() => onReply(message)} className="inline-flex items-center gap-1 hover:text-[var(--cm-accent)]"><Reply size={12} /> Reply</button>}
          {isPublic && mine && <button type="button" onClick={() => onEdit(message)} className="inline-flex items-center gap-1 hover:text-[var(--cm-accent)]"><Pencil size={12} /> Edit</button>}
          {isPublic && (mine || isAdmin) && <button type="button" onClick={() => onDelete(message)} className="inline-flex items-center gap-1 hover:text-rose-600"><Trash2 size={12} /> {mine ? 'Delete' : 'Moderate'}</button>}
          {!mine && (
            <>
              <button type="button" onClick={() => onReport(message)} className="inline-flex items-center gap-1 hover:text-rose-600"><Flag size={12} /> Report</button>
              {isPublic && <button type="button" onClick={() => onBlock(message.sender_id, true)} className="inline-flex items-center gap-1 hover:text-rose-600"><Ban size={12} /> Block</button>}
            </>
          )}
        </div>
      )}
    </article>
  )
}

export default function Community() {
  const { user } = useAuth()
  return <CommunityWorkspace key={user?.id} />
}

function CommunityWorkspace() {
  const { user, session, isAdmin } = useAuth()
  const userId = user?.id
  const hasSessionToken = Boolean(session?.access_token)
  const [channels, setChannels] = useState([])
  const [joined, setJoined] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [initialError, setInitialError] = useState('')
  const [notice, setNotice] = useState('')
  const [active, setActive] = useState({ kind: 'channel', id: 'general' })
  const [messages, setMessages] = useState([])
  const [messageLoading, setMessageLoading] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [chatError, setChatError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [conversations, setConversations] = useState([])
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [conversationError, setConversationError] = useState('')
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [friendError, setFriendError] = useState('')
  const [friendActionError, setFriendActionError] = useState('')
  const [friendBusy, setFriendBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [blocked, setBlocked] = useState([])
  const [blockError, setBlockError] = useState('')
  const [showBlocked, setShowBlocked] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reportError, setReportError] = useState('')
  const [reporting, setReporting] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState('connecting')
  const [realtimeEpoch, setRealtimeEpoch] = useState(0)
  const activeRef = useRef(active)
  const listRef = useRef(null)
  const shouldScrollRef = useRef(true)
  const conversationRequestRef = useRef(0)
  const friendsRequestRef = useRef(0)
  const blockRequestRef = useRef(0)
  const historyRequestRef = useRef(0)

  useEffect(() => {
    let current = true
    const load = async () => {
      if (!supabase || !user?.id || session?.user?.id !== user.id) return
      try {
        const [channelResult, directoryResult] = await Promise.all([
          supabase.from('community_channels').select('slug, description'),
          supabase.from('community_directory').select('user_id').eq('user_id', user.id).maybeSingle(),
        ])
        if (channelResult.error) throw channelResult.error
        if (directoryResult.error) throw directoryResult.error
        if (!current) return
        setChannels((channelResult.data || []).sort((a, b) => CHANNEL_ORDER.indexOf(a.slug) - CHANNEL_ORDER.indexOf(b.slug)))
        setConversationsLoading(Boolean(directoryResult.data))
        setFriendsLoading(Boolean(directoryResult.data))
        setJoined(Boolean(directoryResult.data))
        setInitialError('')
      } catch (error) {
        if (current) setInitialError(`CampusCommunity could not be loaded: ${error.message || 'Please try again.'}`)
      } finally {
        if (current) setInitialLoading(false)
      }
    }
    load()
    return () => { current = false }
  }, [user?.id, session?.user?.id])

  const loadConversations = useCallback(async () => {
    if (!joined || !supabase) return
    const request = ++conversationRequestRef.current
    try {
      const { data, error } = await supabase.rpc('community_conversation_list')
      if (request !== conversationRequestRef.current) return
      if (error) throw error
      setConversationError('')
      setConversations(data || [])
    } catch (error) {
      if (request === conversationRequestRef.current) setConversationError(`Could not load conversations: ${error.message || 'Please try again.'}`)
    } finally {
      if (request === conversationRequestRef.current) setConversationsLoading(false)
    }
  }, [joined])

  const loadBlocked = useCallback(async () => {
    if (!joined || !supabase) return
    const request = ++blockRequestRef.current
    try {
      const { data, error } = await supabase.from('community_blocks').select('blocked_id')
      if (request !== blockRequestRef.current) return
      if (error) throw error
      const ids = (data || []).map((item) => item.blocked_id)
      if (!ids.length) {
        setBlocked([])
        setBlockError('')
        return
      }
      const result = await supabase.from('community_directory').select('user_id, display_name').in('user_id', ids)
      if (request !== blockRequestRef.current) return
      if (result.error) throw result.error
      const names = new Map((result.data || []).map((item) => [item.user_id, item.display_name]))
      setBlocked(ids.map((id) => ({ id, name: names.get(id) || 'Unavailable student' })))
      setBlockError('')
    } catch (error) {
      if (request === blockRequestRef.current) setBlockError(`Could not load blocked students: ${error.message || 'Please try again.'}`)
    }
  }, [joined])

  const loadFriends = useCallback(async () => {
    if (!joined || !supabase || !userId) return
    const request = ++friendsRequestRef.current
    try {
      const [requestsResult, friendsResult] = await Promise.all([
        supabase.from('community_friend_requests')
          .select('id, requester_id, recipient_id, created_at')
          .eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('community_friendships')
          .select('user_a, user_b, updated_at')
          .eq('active', true).order('updated_at', { ascending: false }),
      ])
      if (request !== friendsRequestRef.current) return
      if (requestsResult.error) throw requestsResult.error
      if (friendsResult.error) throw friendsResult.error
      const requestRows = requestsResult.data || []
      const friendRows = friendsResult.data || []
      const peerIds = [...new Set([
        ...requestRows.map((item) => item.requester_id === userId ? item.recipient_id : item.requester_id),
        ...friendRows.map((item) => item.user_a === userId ? item.user_b : item.user_a),
      ])]
      let names = new Map()
      if (peerIds.length) {
        const result = await supabase.from('community_directory')
          .select('user_id, display_name').in('user_id', peerIds)
        if (request !== friendsRequestRef.current) return
        if (result.error) throw result.error
        names = new Map((result.data || []).map((item) => [item.user_id, item.display_name]))
      }
      setFriendRequests(requestRows.map((item) => {
        const incoming = item.recipient_id === userId
        const peerId = incoming ? item.requester_id : item.recipient_id
        return { id: item.id, peerId, peerName: names.get(peerId) || 'Unavailable student', direction: incoming ? 'incoming' : 'outgoing' }
      }))
      setFriends(friendRows.map((item) => {
        const id = item.user_a === userId ? item.user_b : item.user_a
        return { id, name: names.get(id) || 'Unavailable student', available: names.has(id) }
      }))
      setFriendError('')
    } catch (error) {
      if (request === friendsRequestRef.current) setFriendError(`Could not load friends: ${error.message || 'Please try again.'}`)
    } finally {
      if (request === friendsRequestRef.current) setFriendsLoading(false)
    }
  }, [joined, userId])

  useEffect(() => {
    let current = true
    if (joined) {
      Promise.resolve().then(() => {
        if (current) {
          loadConversations()
          loadBlocked()
          loadFriends()
        }
      })
    }
    return () => { current = false; conversationRequestRef.current += 1; blockRequestRef.current += 1; friendsRequestRef.current += 1 }
  }, [joined, loadConversations, loadBlocked, loadFriends])

  const markRead = useCallback(async (conversationId, messageId) => {
    try {
      const { error } = await supabase.rpc('community_mark_read', {
        p_conversation: conversationId, p_message: messageId,
      })
      if (error) throw error
      loadConversations()
    } catch (error) {
      if (activeRef.current.kind === 'direct' && activeRef.current.id === conversationId) {
        setChatError(`Could not update unread messages: ${error.message || 'Please try again.'}`)
      }
    }
  }, [loadConversations])

  useEffect(() => {
    if (!joined || !user?.id || session?.user?.id !== user.id || !hasSessionToken) return undefined
    let disposed = false
    let channel
    let refreshTimer
    let friendRefreshTimer
    let changesReady = false
    const refreshSoon = () => {
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => loadConversations(), 200)
    }
    const refreshFriendsSoon = () => {
      window.clearTimeout(friendRefreshTimer)
      friendRefreshTimer = window.setTimeout(() => {
        loadFriends()
        loadConversations()
      }, 200)
    }
    const markChangesReady = (resync = false) => {
      setRealtimeStatus('connected')
      if (!changesReady || resync) {
        changesReady = true
        setRealtimeEpoch((value) => value + 1)
        refreshFriendsSoon()
      }
    }
    const connect = async () => {
      setRealtimeStatus('connecting')
      try {
        if (await communityChannelRemoval !== 'ok') throw new Error('Previous channel could not be removed.')
        if (disposed) return
        // The shared client reads the current session and refreshes Realtime on auth changes.
        await supabase.realtime.setAuth()
        if (disposed) return
        channel = supabase
          .channel(`campuscommunity:user:${user.id}`, {
            config: { private: true, postgres_changes_options: { wait: true } },
          })
          .on('system', {}, (payload) => {
            if (disposed || payload.extension !== 'postgres_changes') return
            if (payload.status === 'error') {
              changesReady = false
              setRealtimeStatus('unavailable')
            } else if (payload.status === 'ok') {
              // Re-fetch after the server re-establishes Postgres Changes, including token refreshes.
              markChangesReady(true)
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, (payload) => {
            const target = activeRef.current
            if (target.kind !== 'channel') return
            if (payload.eventType === 'DELETE') {
              setMessages((previous) => previous.filter((item) => item.id !== payload.old?.id))
            } else if (payload.new?.channel_slug === target.id) {
              setMessages((previous) => payload.eventType === 'UPDATE' && !previous.some((item) => item.id === payload.new.id)
                ? previous
                : mergeCommunityMessages(previous, [payload.new]))
            }
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_direct_messages' }, (payload) => {
            const target = activeRef.current
            if (target.kind === 'direct' && target.id === payload.new?.conversation_id) {
              setMessages((previous) => mergeCommunityMessages(previous, [payload.new]))
              if (document.visibilityState === 'visible') markRead(target.id, payload.new.id)
            }
            refreshSoon()
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_conversations' }, refreshSoon)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_conversations' }, refreshSoon)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_friend_requests' }, refreshFriendsSoon)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_friend_requests' }, refreshFriendsSoon)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_friendships' }, refreshFriendsSoon)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_friendships' }, refreshFriendsSoon)
          .subscribe((status) => {
            if (disposed) return
            if (status === 'SUBSCRIBED') {
              markChangesReady()
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              changesReady = false
              setRealtimeStatus('unavailable')
            }
          })
      } catch {
        if (!disposed) setRealtimeStatus('unavailable')
      }
    }
    connect()
    return () => {
      disposed = true
      window.clearTimeout(refreshTimer)
      window.clearTimeout(friendRefreshTimer)
      if (channel) communityChannelRemoval = supabase.removeChannel(channel).catch(() => 'error')
    }
  }, [joined, user?.id, session?.user?.id, hasSessionToken, loadConversations, loadFriends, markRead])

  useEffect(() => {
    if (!joined || !active.id) return undefined
    const request = ++historyRequestRef.current
    let current = true
    const load = async () => {
      shouldScrollRef.current = true
      setMessages([])
      setMessageLoading(true)
      setChatError('')
      try {
        const rows = await fetchHistory(active)
        if (!current || request !== historyRequestRef.current) return
        setMessages((previous) => mergeCommunityMessages(rows, previous))
        setHasMore(rows.length === COMMUNITY_PAGE_SIZE)
        if (active.kind === 'direct' && rows[0] && document.visibilityState === 'visible') {
          markRead(active.id, rows[0].id)
        }
      } catch (error) {
        if (current) setChatError(`Could not load messages: ${error.message || 'Please try again.'}`)
      } finally {
        if (current) setMessageLoading(false)
      }
    }
    load()
    return () => { current = false }
  }, [joined, active, realtimeEpoch, markRead])

  useEffect(() => {
    if (shouldScrollRef.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    const markVisible = () => {
      if (document.visibilityState === 'visible' && active.kind === 'direct' && messages.length) {
        markRead(active.id, messages[messages.length - 1].id)
      }
    }
    document.addEventListener('visibilitychange', markVisible)
    return () => document.removeEventListener('visibilitychange', markVisible)
  }, [active.kind, active.id, messages, markRead])

  useEffect(() => {
    const query = search.trim()
    if (!joined || query.length < 2) return undefined
    let current = true
    const timer = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const safeQuery = query.replace(/[\\%_]/g, '\\$&')
        const { data, error } = await supabase.from('community_directory')
          .select('user_id, display_name').neq('user_id', user.id)
          .ilike('display_name', `%${safeQuery}%`).order('display_name').limit(20)
        if (!current) return
        if (error) throw error
        setSearchError('')
        setSearchResults(data || [])
      } catch (error) {
        if (current) {
          setSearchError(`Directory search failed: ${error.message || 'Please try again.'}`)
          setSearchResults([])
        }
      } finally {
        if (current) setSearchLoading(false)
      }
    }, 300)
    return () => { current = false; window.clearTimeout(timer) }
  }, [joined, search, user?.id])

  const selectTarget = (target) => {
    if (activeRef.current.kind === target.kind && activeRef.current.id === target.id) return
    activeRef.current = target
    historyRequestRef.current += 1
    shouldScrollRef.current = true
    setActive(target)
    setMessages([])
    setHasMore(false)
    setChatError('')
    setDraft('')
    setReplyTo(null)
    setEditing(null)
  }

  const join = async () => {
    setJoining(true)
    setInitialError('')
    try {
      const { error } = await supabase.rpc('community_join_directory')
      if (error) throw error
      setConversationsLoading(true)
      setFriendsLoading(true)
      setJoined(true)
    } catch (error) {
      setInitialError(error.message || 'Could not join the community.')
    } finally {
      setJoining(false)
    }
  }

  const leave = async () => {
    if (!window.confirm('Leave CampusCommunity? Your name will be removed from the directory and direct messaging will be unavailable until you rejoin. Existing messages and reports remain.')) return
    setLeaving(true)
    try {
      const { error } = await supabase.rpc('community_leave_directory')
      if (error) throw error
      const target = { kind: 'channel', id: 'general' }
      activeRef.current = target
      historyRequestRef.current += 1
      setActive(target)
      setMessages([])
      setConversations([])
      setFriends([])
      setFriendRequests([])
      setFriendError('')
      setFriendActionError('')
      setSearch('')
      setSearchResults([])
      setBlocked([])
      setJoined(false)
      setDraft('')
      setReplyTo(null)
      setEditing(null)
      setNotice('You left the directory. Existing messages remain until removed.')
    } catch (error) {
      setChatError(`Could not leave the community: ${error.message || 'Please try again.'}`)
    } finally {
      setLeaving(false)
    }
  }

  const startConversation = async (peerId) => {
    setSearchError('')
    try {
      const { data, error } = await supabase.rpc('community_start_conversation', { p_other: peerId })
      if (error) throw error
      if (!data) throw new Error('Conversation unavailable.')
      setSearch('')
      setSearchResults([])
      selectTarget({ kind: 'direct', id: data })
      loadConversations()
    } catch (error) {
      setSearchError(error.message || 'Conversation unavailable.')
      setChatError(`Could not open conversation: ${error.message || 'Please try again.'}`)
    }
  }

  const friendAction = async (name, params, success) => {
    if (friendBusy) return
    setFriendBusy(true)
    setFriendActionError('')
    try {
      const { error } = await supabase.rpc(name, params)
      if (error) throw error
      setNotice(success)
      await Promise.all([loadFriends(), loadConversations()])
    } catch (error) {
      setFriendActionError(error.message || 'Could not update friendship. Please try again.')
      loadFriends()
    } finally {
      setFriendBusy(false)
    }
  }

  const unfriend = (peerId, peerName) => {
    if (!window.confirm(`Unfriend ${peerName}? Your existing messages remain readable, but neither of you can send new DMs until you become friends again.`)) return
    friendAction('community_unfriend', { p_other: peerId }, 'Friend removed. Your existing message history remains available.')
  }

  const changeBlock = async (peerId, shouldBlock) => {
    if (shouldBlock && !window.confirm('Block this student? This ends any friendship or pending request, and prevents new direct messages.')) return
    try {
      const { error } = await supabase.rpc('community_block_user', { p_other: peerId, p_block: shouldBlock })
      if (error) throw error
      setNotice(shouldBlock ? 'Student blocked. Any friendship or pending request has ended.' : 'Student unblocked. A new friendship requires another request.')
      loadBlocked()
      loadConversations()
      loadFriends()
    } catch (error) {
      setChatError(`Could not ${shouldBlock ? 'block' : 'unblock'} this student: ${error.message || 'Please try again.'}`)
    }
  }

  const loadOlder = async () => {
    if (!messages.length || olderLoading) return
    const target = activeRef.current
    const scroll = listRef.current
    const previousHeight = scroll?.scrollHeight || 0
    setOlderLoading(true)
    setChatError('')
    try {
      const rows = await fetchHistory(target, messages[0])
      if (activeRef.current.kind !== target.kind || activeRef.current.id !== target.id) return
      shouldScrollRef.current = false
      setMessages((previous) => mergeCommunityMessages(rows, previous))
      setHasMore(rows.length === COMMUNITY_PAGE_SIZE)
      window.requestAnimationFrame(() => {
        if (scroll) scroll.scrollTop += scroll.scrollHeight - previousHeight
      })
    } catch (error) {
      setChatError(`Could not load older messages: ${error.message || 'Please try again.'}`)
    } finally {
      setOlderLoading(false)
    }
  }

  const send = async (event) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content || content.length > 2000 || sending) return
    const target = activeRef.current
    setSending(true)
    setChatError('')
    try {
      let result
      if (editing) {
        result = await supabase.rpc('community_edit_message', { p_message_id: editing.id, p_content: content })
      } else if (target.kind === 'channel') {
        result = await supabase.rpc('community_send_message', {
          p_channel: target.id, p_content: content, p_reply_to: replyTo?.id || null,
        })
      } else {
        result = await supabase.rpc('community_send_direct_message', { p_conversation: target.id, p_content: content })
      }
      if (result.error) throw result.error
      const message = Array.isArray(result.data) ? result.data[0] : result.data
      if (!message?.id) throw new Error('The server did not confirm the message.')
      if (activeRef.current.kind === target.kind && activeRef.current.id === target.id) {
        shouldScrollRef.current = true
        setMessages((previous) => mergeCommunityMessages(previous, [message]))
        setDraft('')
        setReplyTo(null)
        setEditing(null)
        if (target.kind === 'direct') markRead(target.id, message.id)
      }
      if (target.kind === 'direct') loadConversations()
    } catch (error) {
      setChatError(`Could not send message: ${error.message || 'Please try again.'}`)
      if (target.kind === 'direct') loadConversations()
    } finally {
      setSending(false)
    }
  }

  const deleteMessage = async (message) => {
    if (!window.confirm('Remove this public message?')) return
    try {
      const { error } = await supabase.rpc('community_delete_message', { p_message_id: message.id })
      if (error) throw error
      setMessages((previous) => previous.map((item) => item.id === message.id
        ? { ...item, content: null, deleted_at: new Date().toISOString(), edited_at: null }
        : item))
    } catch (error) {
      setChatError(`Could not remove message: ${error.message || 'Please try again.'}`)
    }
  }

  const report = async (event) => {
    event.preventDefault()
    if (!reportTarget || !reportReason.trim()) return
    setReporting(true)
    setReportError('')
    try {
      const { error } = await supabase.rpc('community_report_message', {
        p_kind: reportTarget.kind, p_message: reportTarget.id, p_reason: reportReason.trim(),
      })
      if (error) throw error
      setReportTarget(null)
      setReportReason('')
      setNotice('Report submitted for review.')
    } catch (error) {
      setReportError(error.code === '23505' ? 'You have already reported this message.' : error.message || 'Could not submit report.')
    } finally {
      setReporting(false)
    }
  }

  const selectedConversation = conversations.find((item) => item.conversation_id === active.id)
  const selectedChannel = channels.find((item) => item.slug === active.id)
  const composerDisabled = active.kind === 'direct' && (!selectedConversation || !selectedConversation.can_message)

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="workspace-page-kicker"><span /> CAMPUS LIFE · CONVERSATIONS</div>
          <h1 className="mt-3 text-4xl text-[var(--cm-text)]">CampusCommunity</h1>
          <p className="mt-2 text-sm text-[var(--cm-muted)]">A shared space for campus conversations.</p>
        </div>
        {joined && (
          <span className="text-xs font-semibold text-[var(--cm-muted)]" role="status">
            {realtimeStatus === 'connected' ? '● Live updates connected' : realtimeStatus === 'unavailable' ? '○ Live updates unavailable' : '○ Connecting to live updates'}
          </span>
        )}
      </div>

      {initialError && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{initialError}</div>}
      {notice && <div role="status" className="flex items-center justify-between gap-2 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-3 text-xs text-[var(--cm-text)]">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={14} /></button></div>}

      {initialLoading ? (
        <div className="flex justify-center gap-2 py-20 text-xs text-[var(--cm-muted)]"><Loader2 className="animate-spin" size={16} /> Loading CampusCommunity...</div>
      ) : !joined ? (
        <div className="max-w-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 sm:p-8">
          <Users size={24} className="text-[var(--cm-accent)]" />
          <h2 className="mt-4 text-2xl text-[var(--cm-text)]">Join the conversation</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--cm-muted)]">
            Joining makes your profile display name and account identifier searchable by other signed-in students.
            Your email and private profile details are not included. Public messages are visible to signed-in students.
          </p>
          <p className="mt-2 text-xs text-[var(--cm-muted)]">Use your profile to update your display name before joining.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={join} disabled={joining || channels.length === 0} className="workspace-primary-button disabled:opacity-50">
              {joining ? 'Joining...' : 'Join CampusCommunity'}
            </button>
            <Link to="/profile" className="inline-flex items-center border border-[var(--cm-border)] px-4 py-2 text-xs font-bold text-[var(--cm-text)]">View profile</Link>
          </div>
        </div>
      ) : (
        <div className="grid overflow-hidden border border-[var(--cm-border)] bg-[var(--cm-surface)] md:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="max-h-72 overflow-y-auto border-b border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 md:max-h-none md:border-b-0 md:border-r">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-[var(--cm-muted)]">Channels</p>
            <div className="space-y-1">
              {channels.map((channel) => (
                <button key={channel.slug} type="button" onClick={() => selectTarget({ kind: 'channel', id: channel.slug })}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold ${active.kind === 'channel' && active.id === channel.slug ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)]' : 'text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]'}`}>
                  <Hash size={14} /> {channel.slug}
                </button>
              ))}
            </div>
            <CommunityFriends
              search={search} onSearch={(value) => { setSearch(value); setSearchError(''); setSearchResults([]); setSearchLoading(value.trim().length >= 2) }}
              searchResults={searchResults} searchLoading={searchLoading} searchError={searchError} fieldClass={FIELD}
              friends={friends} requests={friendRequests} blocked={blocked} loading={friendsLoading}
              error={friendError} actionError={friendActionError} busy={friendBusy}
              onRefresh={() => { setFriendsLoading(true); setFriendActionError(''); loadFriends() }}
              onRequest={(id) => friendAction('community_send_friend_request', { p_other: id }, 'Friend request sent.')}
              onRespond={(id, accept) => friendAction('community_respond_friend_request', { p_request: id, p_accept: accept }, accept ? 'Friend request accepted.' : 'Friend request rejected.')}
              onCancel={(id) => friendAction('community_cancel_friend_request', { p_request: id }, 'Friend request cancelled.')}
              onUnfriend={unfriend} onMessage={startConversation} onUnblock={(id) => changeBlock(id, false)}
            />
            <div className="mt-6 flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--cm-muted)]">Private chat</p>
              <MessageCircle size={14} className="text-[var(--cm-accent)]" />
            </div>
            {conversationError && <p role="alert" className="mt-3 text-xs text-rose-600">{conversationError}</p>}
            <div className="mt-3 space-y-1">
              {conversations.length === 0 && !conversationError && <p className="px-2 py-2 text-xs text-[var(--cm-muted)]">{conversationsLoading ? 'Loading conversations...' : 'No conversations yet.'}</p>}
              {conversations.map((conversation) => (
                <button key={conversation.conversation_id} type="button" onClick={() => selectTarget({ kind: 'direct', id: conversation.conversation_id })}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs ${active.kind === 'direct' && active.id === conversation.conversation_id ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)]' : 'text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]'}`}>
                  <span className="min-w-0"><strong className="block truncate">{conversation.peer_name}</strong><span className="block truncate opacity-75">{conversation.last_content || 'Start a conversation'}</span></span>
                  {Number(conversation.unread_count) > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">{conversation.unread_count}</span>}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowBlocked(!showBlocked)} className="mt-5 text-xs font-bold text-[var(--cm-muted)] hover:text-[var(--cm-text)]">
              Blocked students ({blocked.length}) {showBlocked ? '−' : '+'}
            </button>
            {blockError && <p role="alert" className="mt-2 text-xs text-rose-600">{blockError}</p>}
            {showBlocked && blocked.map((student) => (
              <div key={student.id} className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--cm-muted)]">
                <span className="truncate">{student.name}</span>
                <button type="button" onClick={() => changeBlock(student.id, false)} className="font-bold text-[var(--cm-accent)]">Unblock</button>
              </div>
            ))}
            <button type="button" onClick={leave} disabled={leaving} className="mt-5 block text-xs font-bold text-[var(--cm-muted)] hover:text-[var(--cm-text)] disabled:opacity-50">
              {leaving ? 'Leaving...' : 'Leave community'}
            </button>
          </aside>

          <section className="flex h-[34rem] min-w-0 flex-col sm:h-[40rem]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--cm-border)] px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-xl text-[var(--cm-text)]">
                  {active.kind === 'channel' ? `#${active.id}` : selectedConversation?.peer_name || 'Direct message'}
                </h2>
                <p className="mt-1 text-[11px] text-[var(--cm-muted)]">
                  {active.kind === 'channel' ? selectedChannel?.description : 'Private to the two conversation participants'}
                </p>
              </div>
              {active.kind === 'direct' && selectedConversation && (
                <button type="button" onClick={() => changeBlock(selectedConversation.peer_id, !selectedConversation.blocked_by_me)}
                  className="inline-flex shrink-0 items-center gap-1 border border-[var(--cm-border)] px-3 py-2 text-xs font-bold text-[var(--cm-muted)] hover:text-rose-600">
                  <Ban size={13} /> {selectedConversation.blocked_by_me ? 'Unblock' : 'Block'}
                </button>
              )}
            </div>
            {chatError && <div role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{chatError}</div>}
            {active.kind === 'direct' && composerDisabled && <p className="border-b border-[var(--cm-border)] px-4 py-2 text-xs text-[var(--cm-muted)]">{selectedConversation ? 'Messaging requires an accepted friendship and no blocks. Existing history remains available.' : conversationError ? 'Could not load this conversation.' : 'Loading conversation...'}</p>}
            <div ref={listRef} onScroll={(event) => {
              const element = event.currentTarget
              shouldScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100
            }} className="min-h-0 flex-1 overflow-y-auto" aria-label="Message history">
              {hasMore && <div className="p-3 text-center"><button type="button" disabled={olderLoading} onClick={loadOlder} className="text-xs font-bold text-[var(--cm-accent)] hover:underline">{olderLoading ? 'Loading...' : 'Load older messages'}</button></div>}
              {messageLoading && messages.length === 0 ? <div className="flex justify-center gap-2 py-16 text-xs text-[var(--cm-muted)]"><Loader2 size={15} className="animate-spin" /> Loading messages...</div> : messages.length === 0 && !chatError ? (
                <EmptyState icon={MessageCircle} title="No messages yet" description="Start a conversation when you are ready." />
              ) : messages.map((message) => (
                <MessageRow key={message.id} message={message} messages={messages} isPublic={active.kind === 'channel'} mine={message.sender_id === user.id} isAdmin={isAdmin} peerName={selectedConversation?.peer_name}
                  onReply={(item) => { setEditing(null); setReplyTo(item); setDraft('') }}
                  onEdit={(item) => { setReplyTo(null); setEditing(item); setDraft(item.content) }}
                  onDelete={deleteMessage}
                  onReport={(item) => { setReportTarget({ kind: active.kind === 'channel' ? 'public' : 'direct', id: item.id }); setReportError(''); setReportReason('') }}
                  onBlock={changeBlock} />
              ))}
            </div>
            <form onSubmit={send} className="border-t border-[var(--cm-border)] p-4">
              {(replyTo || editing) && (
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--cm-muted)]">
                  <span className="truncate">{editing ? 'Editing your message' : `Replying to ${replyTo.sender_name}`}</span>
                  <button type="button" onClick={() => { setReplyTo(null); setEditing(null); setDraft('') }} aria-label="Cancel reply or edit"><X size={14} /></button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2}
                  disabled={composerDisabled || sending} placeholder={composerDisabled ? 'Messaging unavailable' : `Message ${active.kind === 'channel' ? `#${active.id}` : 'this student'}`}
                  aria-label="Message" className={`${FIELD} min-h-12 resize-y text-xs disabled:opacity-50`} />
                <button type="submit" disabled={!draft.trim() || composerDisabled || sending} className="workspace-primary-button disabled:opacity-50">
                  {editing ? <Check size={15} /> : <Send size={15} />} {sending ? 'Sending...' : editing ? 'Save' : 'Send'}
                </button>
              </div>
              <p className="mt-2 text-right text-[10px] text-[var(--cm-muted)]">{draft.length}/2000</p>
            </form>
          </section>
        </div>
      )}

      <Modal isOpen={Boolean(reportTarget)} onClose={() => { if (!reporting) setReportTarget(null) }} title="Report message">
        <form onSubmit={report} className="space-y-4">
          <p className="text-xs leading-relaxed text-[var(--cm-muted)]">
            Administrators can review your reason. Private message content is not automatically shared with them.
          </p>
          {reportError && <p role="alert" className="text-xs text-rose-600">{reportError}</p>}
          <label className="block text-xs font-bold text-[var(--cm-text)]" htmlFor="community-report-reason">Reason</label>
          <textarea id="community-report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)}
            rows={4} maxLength={500} required className={FIELD} placeholder="What happened?" />
          <button type="submit" disabled={reporting || !reportReason.trim()} className="workspace-primary-button disabled:opacity-50">
            {reporting ? 'Submitting...' : 'Submit report'}
          </button>
        </form>
      </Modal>
      {isAdmin && <p className="text-xs text-[var(--cm-muted)]">Public messages and reports can be reviewed in the <Link className="font-bold text-[var(--cm-accent)] hover:underline" to="/admin">Admin Panel</Link>.</p>}
    </div>
  )
}
