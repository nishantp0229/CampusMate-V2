import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function CommunityModeration({ searchQuery }) {
  const [messages, setMessages] = useState([])
  const [reports, setReports] = useState([])
  const [reportedMessages, setReportedMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const [messageResult, reportResult] = await Promise.all([
        supabase.from('community_messages')
          .select('id, channel_slug, sender_name, content, created_at')
          .is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
        supabase.from('community_reports')
          .select('id, kind, public_message_id, reason, status, created_at')
          .eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
      ])
      if (messageResult.error) throw messageResult.error
      if (reportResult.error) throw reportResult.error
      const reportedIds = [...new Set((reportResult.data || [])
        .filter((report) => report.kind === 'public' && report.public_message_id)
        .map((report) => report.public_message_id))]
      let reported = []
      if (reportedIds.length) {
        const result = await supabase.from('community_messages')
          .select('id, channel_slug, sender_name, content, deleted_at').in('id', reportedIds)
        if (result.error) throw result.error
        reported = result.data || []
      }
      if (request !== requestRef.current) return
      setMessages(messageResult.data || [])
      setReports(reportResult.data || [])
      setReportedMessages(reported)
    } catch (err) {
      if (request === requestRef.current) setError(`Could not load community moderation: ${err.message || 'Please try again.'}`)
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let current = true
    Promise.resolve().then(() => { if (current) load() })
    return () => { current = false; requestRef.current += 1 }
  }, [load])

  const refresh = () => {
    setLoading(true)
    setError('')
    load()
  }

  const removeMessage = async (id) => {
    if (!window.confirm('Remove this public community message?')) return
    setBusy(true)
    try {
      const { error: actionError } = await supabase.rpc('community_delete_message', { p_message_id: id })
      if (actionError) throw actionError
      setMessages((previous) => previous.filter((message) => message.id !== id))
      setReportedMessages((previous) => previous.map((message) => message.id === id
        ? { ...message, content: null, deleted_at: new Date().toISOString() }
        : message))
    } catch (err) {
      setError(`Could not remove message: ${err.message || 'Please try again.'}`)
    } finally {
      setBusy(false)
    }
  }

  const reviewReport = async (id, status) => {
    setBusy(true)
    try {
      const { error: actionError } = await supabase.rpc('community_review_report', { p_report: id, p_status: status })
      if (actionError) throw actionError
      setReports((previous) => previous.map((report) => report.id === id ? { ...report, status } : report))
    } catch (err) {
      setError(`Could not update report: ${err.message || 'Please try again.'}`)
    } finally {
      setBusy(false)
    }
  }

  const query = searchQuery.trim().toLowerCase()
  const visibleMessages = messages.filter((message) =>
    !query || `${message.sender_name} ${message.channel_slug} ${message.content}`.toLowerCase().includes(query))
  const visibleReports = reports.filter((report) =>
    !query || `${report.kind} ${report.reason} ${report.status}`.toLowerCase().includes(query))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--cm-muted)]">
          Review public messages and reports. Private message content is not automatically shared.
        </p>
        <button type="button" onClick={refresh} disabled={loading || busy} className="inline-flex items-center gap-2 border border-[var(--cm-border)] px-3 py-2 text-xs font-bold text-[var(--cm-text)] disabled:opacity-50">
          <RefreshCw size={13} /> Refresh community
        </button>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
      {loading ? (
        <div className="flex justify-center gap-2 py-12 text-xs text-[var(--cm-muted)]"><Loader2 size={15} className="animate-spin" /> Loading community records...</div>
      ) : (
        <>
          <section className="overflow-hidden border border-[var(--cm-border)] bg-[var(--cm-surface)]">
            <h2 className="border-b border-[var(--cm-border)] px-5 py-4 text-lg text-[var(--cm-text)]">Public messages</h2>
            {visibleMessages.length === 0 ? <p className="p-6 text-center text-xs text-[var(--cm-muted)]">No public messages found.</p> : visibleMessages.map((message) => (
              <div key={message.id} className="flex items-start justify-between gap-4 border-b border-[var(--cm-border)]/60 px-5 py-4 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--cm-text)]">#{message.channel_slug} · {message.sender_name}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[var(--cm-muted)]">{message.content}</p>
                  <p className="mt-1 text-[10px] text-[var(--cm-muted)]">{new Date(message.created_at).toLocaleString()}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => removeMessage(message.id)} aria-label="Remove public message" className="shrink-0 p-2 text-[var(--cm-muted)] hover:text-rose-600 disabled:opacity-50"><Trash2 size={15} /></button>
              </div>
            ))}
          </section>
          <section className="overflow-hidden border border-[var(--cm-border)] bg-[var(--cm-surface)]">
            <h2 className="border-b border-[var(--cm-border)] px-5 py-4 text-lg text-[var(--cm-text)]">Pending reports</h2>
            {visibleReports.length === 0 ? <p className="p-6 text-center text-xs text-[var(--cm-muted)]">No pending reports found.</p> : visibleReports.map((report) => {
              const publicMessage = report.kind === 'public' && reportedMessages.find((message) => message.id === report.public_message_id)
              return (
                <div key={report.id} className="space-y-2 border-b border-[var(--cm-border)]/60 px-5 py-4 last:border-b-0">
                  <p className="text-xs font-bold text-[var(--cm-text)]">{report.kind === 'public' ? 'Public message' : 'Private message report'} · {report.status}</p>
                  <p className="whitespace-pre-wrap break-words text-xs text-[var(--cm-muted)]">{report.reason}</p>
                  {publicMessage && <p className="border-l-2 border-[var(--cm-accent)] pl-2 text-xs text-[var(--cm-muted)]">#{publicMessage.channel_slug}: {publicMessage.content || 'Message removed'}</p>}
                  {report.kind === 'direct' && <p className="text-[11px] text-[var(--cm-muted)]">The private message itself is not available to moderators.</p>}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] text-[var(--cm-muted)]">{new Date(report.created_at).toLocaleString()}</span>
                    {publicMessage && !publicMessage.deleted_at && (
                      <button type="button" disabled={busy} onClick={() => removeMessage(publicMessage.id)} className="text-xs font-bold text-rose-600 disabled:opacity-50">Remove public message</button>
                    )}
                    {report.status === 'pending' && (
                      <>
                        <button type="button" disabled={busy} onClick={() => reviewReport(report.id, 'reviewed')} className="text-xs font-bold text-[var(--cm-accent)] disabled:opacity-50">Mark reviewed</button>
                        <button type="button" disabled={busy} onClick={() => reviewReport(report.id, 'dismissed')} className="text-xs font-bold text-[var(--cm-muted)] disabled:opacity-50">Dismiss</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
          <p className="text-[11px] text-[var(--cm-muted)]">Showing the most recent 100 public messages and 100 pending reports.</p>
        </>
      )}
    </div>
  )
}
