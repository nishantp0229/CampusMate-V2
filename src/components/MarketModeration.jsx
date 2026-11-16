// src/components/MarketModeration.jsx — Admin moderation panel for CampusMarket
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  ShoppingBag,
  Tag,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatPrice } from '../lib/market'

export default function MarketModeration({ searchQuery = '' }) {
  const [reports, setReports] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [subTab, setSubTab] = useState('reports') // 'reports' | 'all_listings'
  const requestRef = useRef(0)

  const loadData = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const currentReq = ++requestRef.current
    setError('')

    try {
      // 1. Fetch reports with joined listing details if available
      const [reportsRes, listingsRes] = await Promise.all([
        supabase
          .from('market_listing_reports')
          .select(`
            id,
            listing_id,
            reporter_id,
            reason,
            status,
            created_at,
            market_listings (
              id,
              title,
              price,
              category,
              condition,
              status,
              seller_id
            )
          `)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('market_listings')
          .select(`
            id,
            title,
            description,
            price,
            category,
            condition,
            status,
            seller_id,
            created_at
          `)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (reportsRes.error) throw reportsRes.error
      if (listingsRes.error) throw listingsRes.error

      if (currentReq === requestRef.current) {
        setReports(reportsRes.data || [])
        setListings(listingsRes.data || [])
      }
    } catch (err) {
      console.error('[CampusMarket Admin] Error loading data:', err)
      if (currentReq === requestRef.current) {
        setError(`Could not load market moderation records: ${err.message || 'Please try again.'}`)
      }
    } finally {
      if (currentReq === requestRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) loadData()
    })
    return () => {
      active = false
      requestRef.current += 1
    }
  }, [loadData])

  const handleReviewReport = async (reportId, nextStatus) => {
    if (!supabase) return
    setActionLoading(true)
    setError('')

    try {
      const { error: rpcErr } = await supabase.rpc('market_admin_review_report', {
        p_report_id: reportId,
        p_status: nextStatus,
      })

      if (rpcErr) throw rpcErr

      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: nextStatus } : r))
      )
    } catch (err) {
      console.error('[CampusMarket Admin] Review error:', err)
      setError(`Failed to update report: ${err.message || 'Please try again.'}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteListing = async (listingId) => {
    if (!window.confirm('Admin confirmation: Permanently delete this listing? In the reviewed Market schema, this also permanently deletes its reports.')) {
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const { error: deleteErr } = await supabase.rpc('market_delete_listing', {
        p_listing_id: listingId,
      })

      if (deleteErr) throw deleteErr

      // Reload both tables: the reviewed schema cascades listing deletion to reports.
      await loadData()
    } catch (err) {
      console.error('[CampusMarket Admin] Delete listing error:', err)
      setError(`Failed to delete listing: ${err.message || 'Please try again.'}`)
    } finally {
      setActionLoading(false)
    }
  }

  const filteredReports = reports.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const listingTitle = r.market_listings?.title || ''
    return (
      (r.reason || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q) ||
      listingTitle.toLowerCase().includes(q)
    )
  })

  const filteredListings = listings.filter((l) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (l.title || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q) ||
      (l.condition || '').toLowerCase().includes(q) ||
      (l.status || '').toLowerCase().includes(q)
    )
  })

  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Sub tabs and refresh button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cm-border)] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('reports')}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              subTab === 'reports'
                ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
                : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]'
            }`}
          >
            <AlertTriangle size={14} />
            <span>Listing Reports</span>
            {pendingReportsCount > 0 && (
              <span className="rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[10px] font-extrabold">
                {pendingReportsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('all_listings')}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              subTab === 'all_listings'
                ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
                : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]'
            }`}
          >
            <ShoppingBag size={14} />
            <span>All Listings ({listings.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true)
            loadData()
          }}
          disabled={loading || actionLoading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-1.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs font-semibold text-[var(--cm-muted)] flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin text-[var(--cm-accent)]" /> Loading market records...
        </div>
      ) : subTab === 'reports' ? (
        /* ── REPORTS TABLE ── */
        <div className="overflow-hidden rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-xs">
          <div className="bg-[var(--cm-bg)] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)] grid grid-cols-12 gap-3">
            <div className="col-span-5">Reported Listing & Reason</div>
            <div className="col-span-3">Status & Reported Date</div>
            <div className="col-span-4 text-right">Moderation Actions</div>
          </div>

          <div className="divide-y divide-[var(--cm-border)]/60">
            {filteredReports.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--cm-muted)]">
                No listing reports match the criteria.
              </div>
            ) : (
              filteredReports.map((report) => {
                const listing = report.market_listings
                const isPending = report.status === 'pending'

                return (
                  <div
                    key={report.id}
                    className="px-5 py-3.5 grid grid-cols-12 gap-3 items-center text-xs hover:bg-[var(--cm-secondary)]/30 transition"
                  >
                    <div className="col-span-5 min-w-0">
                      <p className="font-bold text-[var(--cm-text)] truncate">
                        {listing?.title || <span className="italic text-[var(--cm-muted)]">[Listing Deleted]</span>}
                      </p>
                      {listing && (
                        <p className="text-[11px] text-[var(--cm-muted)]">
                          {listing.category} · {formatPrice(listing.price)} · Status: {listing.status}
                        </p>
                      )}
                      <div className="mt-1.5 rounded-lg border border-[var(--cm-border)]/60 bg-[var(--cm-bg)] p-2 text-[11px] text-[var(--cm-text)]">
                        <span className="font-bold text-[var(--cm-muted)]">Reason: </span>
                        {report.reason}
                      </div>
                    </div>

                    <div className="col-span-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase mb-1 ${
                          report.status === 'pending'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            : report.status === 'reviewed'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {report.status}
                      </span>
                      <p className="text-[11px] text-[var(--cm-muted)]">
                        {new Date(report.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="col-span-4 flex items-center justify-end gap-2 flex-wrap">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReviewReport(report.id, 'reviewed')}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-50"
                            title="Mark Reviewed"
                          >
                            <CheckCircle size={13} />
                            <span>Mark Reviewed</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReviewReport(report.id, 'dismissed')}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-bg)] px-2 py-1 text-[11px] font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer disabled:opacity-50"
                            title="Dismiss Report"
                          >
                            <XCircle size={13} />
                            <span>Dismiss</span>
                          </button>
                        </>
                      )}

                      {listing && (
                        <button
                          type="button"
                          onClick={() => handleDeleteListing(listing.id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                          title="Delete Listing"
                        >
                          <Trash2 size={13} />
                          <span>Delete Listing</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        /* ── ALL LISTINGS TABLE ── */
        <div className="overflow-hidden rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-xs">
          <div className="bg-[var(--cm-bg)] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)] grid grid-cols-12 gap-3">
            <div className="col-span-5">Item & Description</div>
            <div className="col-span-3">Category & Condition</div>
            <div className="col-span-2">Price & Status</div>
            <div className="col-span-2 text-right">Moderation</div>
          </div>

          <div className="divide-y divide-[var(--cm-border)]/60">
            {filteredListings.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--cm-muted)]">
                No market listings found.
              </div>
            ) : (
              filteredListings.map((item) => (
                <div
                  key={item.id}
                  className="px-5 py-3.5 grid grid-cols-12 gap-3 items-center text-xs hover:bg-[var(--cm-secondary)]/30 transition"
                >
                  <div className="col-span-5 min-w-0">
                    <p className="font-bold text-[var(--cm-text)] truncate">{item.title}</p>
                    <p className="text-[11px] text-[var(--cm-muted)] truncate">{item.description}</p>
                  </div>

                  <div className="col-span-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--cm-secondary)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--cm-muted)] mb-0.5">
                      <Tag size={10} /> {item.category}
                    </span>
                    <p className="text-[11px] text-[var(--cm-muted)]">{item.condition}</p>
                  </div>

                  <div className="col-span-2">
                    <p className="font-extrabold text-[var(--cm-accent)]">{formatPrice(item.price)}</p>
                    <span
                      className={`inline-block rounded-md px-1.5 py-0.2 text-[10px] font-bold uppercase ${
                        item.status === 'available'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteListing(item.id)}
                      disabled={actionLoading}
                      className="p-1.5 rounded-lg text-[var(--cm-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                      title="Permanently Delete Listing"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
