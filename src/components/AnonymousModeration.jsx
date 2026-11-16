// src/components/AnonymousModeration.jsx — Admin moderation panel for CampusAnonymous reports

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, CheckCircle, XCircle, ShieldAlert, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AnonymousModeration({ searchQuery = '' }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [transcriptReportId, setTranscriptReportId] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [transcriptLoading, setTranscriptLoading] = useState(false)

  const loadReports = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchErr } = await supabase
        .from('anonymous_reports')
        .select('id, reason, snippet, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchErr) throw fetchErr
      setReports(data || [])
    } catch (err) {
      console.error('Failed to load anonymous reports:', err)
      setError(`Could not load reports: ${err.message || 'Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleUpdateStatus = async (reportId, nextStatus) => {
    if (!supabase) return
    setActionLoading(true)
    setError('')

    try {
      const { error: rpcErr } = await supabase.rpc('anonymous_admin_review_report', {
        p_report_id: reportId,
        p_status: nextStatus,
      })

      if (rpcErr) throw rpcErr

      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: nextStatus } : r))
      )
    } catch (err) {
      console.error('Failed to update report status:', err)
      setError(`Failed to update status: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleViewTranscript = async (reportId) => {
    if (!supabase) return
    setTranscriptReportId(reportId)
    setTranscript([])
    setTranscriptLoading(true)
    setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('anonymous_admin_get_report_transcript', {
        p_report_id: reportId,
      })
      if (rpcErr) throw rpcErr
      setTranscript(data || [])
    } catch (err) {
      setError(`Could not load the report transcript: ${err.message || 'Please try again.'}`)
    } finally {
      setTranscriptLoading(false)
    }
  }

  const filtered = reports.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (r.reason || '').toLowerCase().includes(q) ||
      (r.snippet || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {/* Privacy Notice Banner */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-200">
        <ShieldAlert size={18} className="shrink-0 text-purple-600 dark:text-purple-400" />
        <p>
          <strong>Report evidence:</strong> Administrators can inspect the transcript associated with
          a specific report. Unreported conversations are not available through this panel.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--cm-text)]">
          Abuse Reports ({filtered.length})
        </h2>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            loadReports()
          }}
          disabled={loading || actionLoading}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--cm-border)] px-3 py-1.5 text-xs font-semibold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs text-[var(--cm-muted)]">
          <Loader2 size={16} className="animate-spin text-[var(--cm-accent)] mr-2" />
          <span>Loading abuse reports...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-10 text-center text-xs text-[var(--cm-muted)]">
          No reports found matching your criteria.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-xs">
          <div className="divide-y divide-[var(--cm-border)]/60">
            {filtered.map((report) => (
              <div key={report.id} className="p-4 transition hover:bg-[var(--cm-secondary)]/15">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--cm-text)]">
                        {report.reason}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          report.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : report.status === 'reviewed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>

                    {report.snippet && (
                      <div className="mt-1.5 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] p-2.5 text-xs text-[var(--cm-text)]">
                        <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)] block mb-0.5">
                          Reported Snippet Evidence:
                        </span>
                        <p className="italic text-[var(--cm-muted)] break-words">
                          &ldquo;{report.snippet}&rdquo;
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--cm-muted)] pt-1">
                      <Clock size={11} />
                      <span>{new Date(report.created_at).toLocaleString()}</span>
                    </div>
                    {transcriptReportId === report.id && (
                      <div className="mt-3 space-y-2 rounded-lg border border-[var(--cm-border)] p-3 text-xs">
                        <strong>Report transcript</strong>
                        {transcriptLoading ? <p>Loading transcript...</p> : transcript.length === 0 ? (
                          <p>No messages are available.</p>
                        ) : transcript.map((message) => (
                          <p key={message.message_id} className="break-words">
                            <strong>{message.sender_alias}:</strong> {message.content}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={transcriptLoading}
                      onClick={() => handleViewTranscript(report.id)}
                      className="rounded-lg border border-[var(--cm-border)] px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      View transcript
                    </button>
                    {report.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(report.id, 'reviewed')}
                          className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 disabled:opacity-50"
                        >
                          <CheckCircle size={13} />
                          <span>Mark Reviewed</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                          className="flex items-center gap-1 rounded-lg border border-[var(--cm-border)] px-2.5 py-1 text-xs font-semibold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] disabled:opacity-50"
                        >
                          <XCircle size={13} />
                          <span>Dismiss</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
