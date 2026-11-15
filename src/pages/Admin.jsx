// src/pages/Admin.jsx — Secure Admin Moderation Console for CampusMate
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Compass,
  BookOpen,
  Users,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Lock,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const TABS = [
  { id: 'events', label: 'CampusConnect Events', icon: CalendarDays },
  { id: 'lost_found', label: 'CampusFind Listings', icon: Compass },
  { id: 'resources', label: 'NoteNest Resources', icon: BookOpen },
]

export default function Admin() {
  const { user, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('events')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEvents: 0,
    totalLostFound: 0,
    totalResources: 0,
  })

  const [events, setEvents] = useState([])
  const [lostFound, setLostFound] = useState([])
  const [resources, setResources] = useState([])

  // Fetch admin dashboard data
  const fetchData = useCallback(async () => {
    if (!supabase || !user) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // 1. Fetch counts
      const [
        { count: userCount },
        { count: eventCount },
        { count: lfCount },
        { count: resCount },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('lost_found').select('*', { count: 'exact', head: true }),
        supabase.from('resources').select('*', { count: 'exact', head: true }),
      ])

      setStats({
        totalUsers: userCount || 0,
        totalEvents: eventCount || 0,
        totalLostFound: lfCount || 0,
        totalResources: resCount || 0,
      })

      // 2. Fetch full records for moderation
      const [{ data: eventsData }, { data: lfData }, { data: resData }] =
        await Promise.all([
          supabase.from('events').select('*').order('created_at', { ascending: false }),
          supabase.from('lost_found').select('*').order('created_at', { ascending: false }),
          supabase.from('resources').select('*').order('created_at', { ascending: false }),
        ])

      setEvents(eventsData || [])
      setLostFound(lfData || [])
      setResources(resData || [])
    } catch (err) {
      console.error('[CampusMate Admin] Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (isAdmin) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [isAdmin, fetchData])

  // Admin delete actions (enforced by RLS)
  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Admin Confirmation: Permanently delete this event?')) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) {
        alert('Failed to delete event: ' + error.message)
      } else {
        setEvents((prev) => prev.filter((item) => item.id !== id))
        setStats((prev) => ({ ...prev, totalEvents: Math.max(0, prev.totalEvents - 1) }))
      }
    } catch (err) {
      console.error('Error deleting event:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteLostFound = async (id) => {
    if (!window.confirm('Admin Confirmation: Permanently delete this lost & found post?')) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('lost_found').delete().eq('id', id)
      if (error) {
        alert('Failed to delete listing: ' + error.message)
      } else {
        setLostFound((prev) => prev.filter((item) => item.id !== id))
        setStats((prev) => ({ ...prev, totalLostFound: Math.max(0, prev.totalLostFound - 1) }))
      }
    } catch (err) {
      console.error('Error deleting listing:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolveLostFound = async (id, isResolved) => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('lost_found')
        .update({ is_resolved: !isResolved })
        .eq('id', id)

      if (error) {
        alert('Failed to update status: ' + error.message)
      } else {
        setLostFound((prev) =>
          prev.map((item) => (item.id === id ? { ...item, is_resolved: !isResolved } : item))
        )
      }
    } catch (err) {
      console.error('Error updating status:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteResource = async (id) => {
    if (!window.confirm('Admin Confirmation: Permanently remove this study resource?')) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('resources').delete().eq('id', id)
      if (error) {
        alert('Failed to delete resource: ' + error.message)
      } else {
        setResources((prev) => prev.filter((item) => item.id !== id))
        setStats((prev) => ({ ...prev, totalResources: Math.max(0, prev.totalResources - 1) }))
      }
    } catch (err) {
      console.error('Error deleting resource:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // If user is not an administrator
  if (!loading && !isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
          <Lock size={32} />
        </div>
        <h1 className="font-['Poppins'] text-2xl font-extrabold text-[var(--cm-text)]">
          Administrator Access Required
        </h1>
        <p className="mt-2 text-sm text-[var(--cm-muted)] max-w-md mx-auto">
          Your account is not registered in the <code>admin_users</code> registry. Admin privileges are enforced securely in Supabase PostgreSQL.
        </p>
        <div className="mt-6 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5 text-left text-xs max-w-lg mx-auto space-y-2">
          <p className="font-bold text-[var(--cm-text)]">To assign your account as administrator:</p>
          <ol className="list-decimal list-inside space-y-1 text-[var(--cm-muted)]">
            <li>Copy your User UID from <strong>Supabase Dashboard → Authentication → Users</strong>.</li>
            <li>In Supabase <strong>SQL Editor</strong>, run:</li>
          </ol>
          <pre className="overflow-x-auto rounded-xl bg-[var(--cm-bg)] p-3 text-[11px] font-mono text-[var(--cm-accent)] border border-[var(--cm-border)]">
{`INSERT INTO public.admin_users (user_id) 
VALUES ('${user?.id || '<YOUR-USER-ID>'}') 
ON CONFLICT (user_id) DO NOTHING;`}
          </pre>
        </div>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--cm-accent)] px-5 py-2.5 text-xs font-bold text-[var(--cm-accent-text)] hover:opacity-90 transition"
          >
            Return to Student Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16">
      {/* ── 1. ADMIN HEADER ── */}
      <div className="workspace-page-header border-b border-[var(--cm-border)] bg-[var(--cm-surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <div className="workspace-page-kicker">
                <span /> CAMPUSMATE ADMIN CONSOLE · MODERATION & GOVERNANCE
              </div>
              <h1 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--cm-text)]">
                Platform Moderation
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-[var(--cm-muted)] leading-relaxed">
                Review community content across CampusConnect, CampusFind, and NoteNest. Delete inappropriate listings with full Supabase RLS security.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={fetchData}
                disabled={loading || actionLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-4 py-2.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Data
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* ── 2. METRICS OVERVIEW ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cm-accent-tint)] text-[var(--cm-accent)]">
                <Users size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                  Registered Students
                </span>
                <p className="font-['Poppins'] text-xl font-extrabold text-[var(--cm-text)]">
                  {stats.totalUsers}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                <CalendarDays size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                  Campus Events
                </span>
                <p className="font-['Poppins'] text-xl font-extrabold text-[var(--cm-text)]">
                  {stats.totalEvents}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                <Compass size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                  Lost & Found Posts
                </span>
                <p className="font-['Poppins'] text-xl font-extrabold text-[var(--cm-text)]">
                  {stats.totalLostFound}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <BookOpen size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                  Study Resources
                </span>
                <p className="font-['Poppins'] text-xl font-extrabold text-[var(--cm-text)]">
                  {stats.totalResources}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. MODERATION TABS & SEARCH ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-1 text-xs">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveTab(id)
                  setSearchQuery('')
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition cursor-pointer ${
                  activeTab === id
                    ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
                    : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]"
            />
            <input
              type="text"
              placeholder={`Search ${activeTab.replace('_', ' ')}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] pl-9 pr-3 py-2 text-xs text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-accent)] focus:outline-none transition shadow-2xs"
            />
          </div>
        </div>

        {/* ── 4. CONTENT LISTING ── */}
        {loading ? (
          <div className="py-20 text-center text-xs font-semibold text-[var(--cm-muted)] flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin text-[var(--cm-accent)]" /> Loading records...
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-xs">
            {/* ── EVENTS TABLE ── */}
            {activeTab === 'events' && (
              <div className="divide-y divide-[var(--cm-border)]/60">
                <div className="bg-[var(--cm-bg)] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)] grid grid-cols-12 gap-3">
                  <div className="col-span-5">Event Title & Organizer</div>
                  <div className="col-span-3">Category & Date</div>
                  <div className="col-span-2">Location</div>
                  <div className="col-span-2 text-right">Moderation</div>
                </div>

                {events.filter((e) =>
                  !searchQuery ||
                  e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  e.organizer?.toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 ? (
                  <div className="py-12 text-center text-xs text-[var(--cm-muted)]">
                    No events found.
                  </div>
                ) : (
                  events
                    .filter((e) =>
                      !searchQuery ||
                      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      e.organizer?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="px-5 py-3.5 grid grid-cols-12 gap-3 items-center text-xs hover:bg-[var(--cm-secondary)]/30 transition"
                      >
                        <div className="col-span-5 min-w-0">
                          <p className="font-bold text-[var(--cm-text)] truncate">{item.title}</p>
                          <p className="text-[11px] text-[var(--cm-muted)] truncate">
                            Organized by {item.organizer}
                          </p>
                        </div>
                        <div className="col-span-3">
                          <span className="inline-block rounded-md bg-[var(--cm-secondary)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--cm-muted)] mb-0.5">
                            {item.category}
                          </span>
                          <p className="text-[11px] text-[var(--cm-muted)]">
                            {new Date(item.event_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="col-span-2 truncate text-[var(--cm-muted)]">
                          {item.location}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          {item.registration_url && (
                            <a
                              href={item.registration_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-[var(--cm-muted)] hover:text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition"
                              title="Open Registration Link"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(item.id)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg text-[var(--cm-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Event"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* ── LOST & FOUND TABLE ── */}
            {activeTab === 'lost_found' && (
              <div className="divide-y divide-[var(--cm-border)]/60">
                <div className="bg-[var(--cm-bg)] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)] grid grid-cols-12 gap-3">
                  <div className="col-span-5">Item & Description</div>
                  <div className="col-span-2">Type & Area</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3 text-right">Moderation</div>
                </div>

                {lostFound.filter((i) =>
                  !searchQuery ||
                  i.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  i.location?.toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 ? (
                  <div className="py-12 text-center text-xs text-[var(--cm-muted)]">
                    No lost & found listings found.
                  </div>
                ) : (
                  lostFound
                    .filter((i) =>
                      !searchQuery ||
                      i.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      i.location?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="px-5 py-3.5 grid grid-cols-12 gap-3 items-center text-xs hover:bg-[var(--cm-secondary)]/30 transition"
                      >
                        <div className="col-span-5 min-w-0">
                          <p className="font-bold text-[var(--cm-text)] truncate">{item.item_name}</p>
                          <p className="text-[11px] text-[var(--cm-muted)] truncate">
                            {item.location} · {item.description}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[9px] font-extrabold uppercase text-white ${
                              item.type === 'lost' ? 'bg-rose-600' : 'bg-emerald-600'
                            }`}
                          >
                            {item.type}
                          </span>
                          <p className="text-[11px] text-[var(--cm-muted)] mt-1">{item.location_tag}</p>
                        </div>
                        <div className="col-span-2">
                          <span
                            className={`text-[11px] font-bold ${
                              item.is_resolved
                                ? 'text-slate-500 line-through'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {item.is_resolved ? 'Resolved' : 'Active'}
                          </span>
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleResolveLostFound(item.id, item.is_resolved)}
                            disabled={actionLoading}
                            className="rounded-lg border border-[var(--cm-border)] px-2.5 py-1 text-[11px] font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
                          >
                            {item.is_resolved ? 'Reopen' : 'Mark Returned'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLostFound(item.id)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg text-[var(--cm-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Post"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* ── RESOURCES TABLE ── */}
            {activeTab === 'resources' && (
              <div className="divide-y divide-[var(--cm-border)]/60">
                <div className="bg-[var(--cm-bg)] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)] grid grid-cols-12 gap-3">
                  <div className="col-span-5">Resource Title & Subject</div>
                  <div className="col-span-3">Format & Semester</div>
                  <div className="col-span-2">Link</div>
                  <div className="col-span-2 text-right">Moderation</div>
                </div>

                {resources.filter((r) =>
                  !searchQuery ||
                  r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  r.subject.toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 ? (
                  <div className="py-12 text-center text-xs text-[var(--cm-muted)]">
                    No resources found.
                  </div>
                ) : (
                  resources
                    .filter((r) =>
                      !searchQuery ||
                      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.subject.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="px-5 py-3.5 grid grid-cols-12 gap-3 items-center text-xs hover:bg-[var(--cm-secondary)]/30 transition"
                      >
                        <div className="col-span-5 min-w-0">
                          <p className="font-bold text-[var(--cm-text)] truncate">{item.title}</p>
                          <p className="text-[11px] text-[var(--cm-muted)] truncate">{item.subject}</p>
                        </div>
                        <div className="col-span-3">
                          <span className="inline-block rounded-md bg-[var(--cm-secondary)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--cm-muted)] mb-0.5">
                            {item.resource_type}
                          </span>
                          <p className="text-[11px] text-[var(--cm-muted)]">Semester {item.semester}</p>
                        </div>
                        <div className="col-span-2">
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--cm-accent)] hover:underline truncate"
                            >
                              Open Drive <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        <div className="col-span-2 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleDeleteResource(item.id)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg text-[var(--cm-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Resource"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
