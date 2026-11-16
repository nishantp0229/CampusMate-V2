// src/pages/Events.jsx — CampusConnect events & student clubs connected to Supabase

import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  CalendarDays,
  Plus,
  Search,
  MapPin,
  Clock,
  Users,
  CheckCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
  Edit2,
  Trash2,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const CLUBS = [
  {
    name: 'DTU ACM Student Chapter',
    category: 'Technical',
    tagline: 'Competitive programming, open-source hacks & FAANG prep',
    members: '450+ Members',
    badge: 'Flagship Club',
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=700&q=80',
  },
  {
    name: 'AI & Machine Learning Club',
    category: 'Research',
    tagline: 'Kaggle challenges, LLM fine-tuning & computer vision',
    members: '320+ Members',
    badge: 'High Impact',
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=700&q=80',
  },
  {
    name: 'Nritya & Music Council (AURORA)',
    category: 'Cultural',
    tagline: 'Band nights, street plays, classical dance & annual fest',
    members: '280+ Members',
    badge: 'Fest Champions',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=700&q=80',
  },
  {
    name: 'DTU Blue Thunder Sports Council',
    category: 'Athletics',
    tagline: 'T20 cricket, football leagues, basketball & athletics',
    members: '500+ Athletes',
    badge: 'Inter-College Cup',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=700&q=80',
  },
]

const CLUB_PATHWAY = [
  { step: '01', title: 'Attend the Club Fair', desc: 'Visit booths during fresher orientation week and see live projects.' },
  { step: '02', title: 'Follow & Connect', desc: 'Join the club WhatsApp groups, Discord servers, and GitHub repos.' },
  { step: '03', title: 'Try a Mini Task', desc: 'Participate in beginner-friendly hackathons or audition workshops.' },
  { step: '04', title: 'Apply & Get Selected', desc: 'Interview with senior leads and start organizing flagship fests!' },
]

const getCategoryGroup = (category) => {
  const c = category?.toLowerCase() || ''
  if (c.includes('cultural') || c.includes('art') || c.includes('music') || c.includes('fest')) return 'Cultural'
  if (c.includes('sports') || c.includes('cricket') || c.includes('football')) return 'Sports'
  return 'Technical'
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Date TBD'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const formatDateBlock = (dateStr) => {
  if (!dateStr) return { month: 'TBD', day: '--' }
  const d = new Date(dateStr)
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
  }
}

const INITIAL_FORM = {
  title: '',
  category: 'workshop',
  date: '',
  time: '10:00',
  location: '',
  organizer: '',
  registrationUrl: '',
  description: '',
}

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-none transition'
const LABEL_CLASS = 'mb-1 block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider'

function Events() {
  const { state } = useLocation()
  const { user, studentName, isAdmin } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedFilter, setSelectedFilter] = useState('All Events')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(Boolean(state?.openCreate))
  const [editingEventId, setEditingEventId] = useState(null)
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [savedEvents, setSavedEvents] = useState(() => {
    try {
      const stored = localStorage.getItem(`cm-rsvps-${user?.id}`)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Fetch real events from Supabase
  useEffect(() => {
    let isMounted = true

    const fetchEvents = async () => {
      if (!supabase) {
        if (isMounted) {
          setEvents([])
          setLoading(false)
        }
        return
      }

      try {
        if (isMounted) {
          setLoading(true)
          setError(null)
        }

        const { data, error: fetchErr } = await supabase
          .from('events')
          .select('*')
          .order('event_date', { ascending: true })

        if (!isMounted) return

        if (fetchErr) {
          console.error('[CampusMate] Error fetching events:', fetchErr.message)
          setError('Failed to load campus events from database.')
        } else {
          const loaded = (data || []).map((e) => ({
            id: e.id,
            created_by: e.created_by,
            isPublic: e.is_public === true,
            title: e.title,
            description: e.description || '',
            category: e.category || 'general',
            location: e.location || 'Campus Quad',
            date: e.event_date,
            organizer: e.organizer || 'Student Chapter',
            registrationUrl: e.registration_url,
            image: e.image_url || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
          }))
          setEvents(loaded)

          if (state?.selectedId) {
            const match = loaded.find((item) => item.id === state.selectedId)
            if (match) setSelectedEvent(match)
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('[CampusMate] Exception fetching events:', err)
          setError('An error occurred while loading events.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchEvents()

    return () => {
      isMounted = false
    }
  }, [state?.selectedId])

  const toggleSavedEvent = (eventId) => {
    const next = new Set(savedEvents)
    if (next.has(eventId)) next.delete(eventId)
    else next.add(eventId)
    try {
      localStorage.setItem(`cm-rsvps-${user?.id}`, JSON.stringify([...next]))
      setSavedEvents(next)
    } catch {
      alert('Could not save this event on this device.')
    }
  }

  const filteredEvents = events
    .filter((event) => {
      const group = getCategoryGroup(event.category)
      if (selectedFilter !== 'All Events' && group !== selectedFilter) return false
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      return (
        event.title.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q) ||
        event.description?.toLowerCase().includes(q) ||
        event.organizer?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const handleEditClick = (event, e) => {
    e?.stopPropagation()
    setEditingEventId(event.id)
    const d = new Date(event.date)
    const dateStr = !isNaN(d.getTime())
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : ''
    const hours = !isNaN(d.getTime()) ? String(d.getHours()).padStart(2, '0') : '10'
    const mins = !isNaN(d.getTime()) ? String(d.getMinutes()).padStart(2, '0') : '00'

    setFormData({
      title: event.title,
      category: event.category,
      date: dateStr,
      time: `${hours}:${mins}`,
      location: event.location,
      organizer: event.organizer,
      registrationUrl: event.registrationUrl || '',
      description: event.description || '',
    })
    setIsAddOpen(true)
  }

  const handleDeleteEvent = async (eventId, e) => {
    e?.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return
    try {
      const { data, error: delErr } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .select('id')
        .maybeSingle()

      if (delErr) {
        alert('Could not delete event: ' + delErr.message)
      } else if (!data) {
        alert('The event was not deleted. It may no longer exist or access was denied.')
      } else {
        setEvents((prev) => prev.filter((ev) => ev.id !== eventId))
        if (selectedEvent?.id === eventId) setSelectedEvent(null)
      }
    } catch (err) {
      console.error('[CampusMate] Exception deleting event:', err)
      alert('Could not delete event. Please try again.')
    }
  }

  const handleSaveEvent = async (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.location.trim() || !supabase || !user?.id) return

    try {
      setSubmitting(true)
      const dateTime = formData.date
        ? `${formData.date}T${formData.time || '10:00'}`
        : new Date().toISOString()

      const payload = {
        title: formData.title.trim(),
        category: formData.category.toLowerCase(),
        event_date: new Date(dateTime).toISOString(),
        location: formData.location.trim(),
        organizer: formData.organizer.trim() || studentName || 'Campus Student',
        registration_url: formData.registrationUrl.trim() || null,
        description: formData.description.trim() || null,
      }

      if (editingEventId) {
        const { data, error: updateErr } = await supabase
          .from('events')
          .update(payload)
          .eq('id', editingEventId)
          .select()
          .single()

        if (updateErr) {
          console.error('[CampusMate] Error updating event:', updateErr.message)
          alert('Could not update event: ' + updateErr.message)
        } else if (data) {
          setEvents((prev) =>
            prev.map((ev) =>
              ev.id === editingEventId
                ? {
                    ...ev,
                    title: data.title,
                    category: data.category,
                    date: data.event_date,
                    location: data.location,
                    organizer: data.organizer,
                    registrationUrl: data.registration_url,
                    description: data.description,
                  }
                : ev
            )
          )
          if (selectedEvent?.id === editingEventId) {
            setSelectedEvent((prev) => ({
              ...prev,
              title: data.title,
              category: data.category,
              date: data.event_date,
              location: data.location,
              organizer: data.organizer,
              registrationUrl: data.registration_url,
              description: data.description,
            }))
          }
          setFormData(INITIAL_FORM)
          setEditingEventId(null)
          setIsAddOpen(false)
        }
      } else {
        const { data, error: insertErr } = await supabase
          .from('events')
          .insert({ ...payload, created_by: user.id, is_public: true })
          .select()
          .single()

        if (insertErr) {
          console.error('[CampusMate] Error creating event:', insertErr.message)
          alert('Could not save event: ' + insertErr.message)
        } else if (data) {
          const created = {
            id: data.id,
            created_by: data.created_by,
            isPublic: data.is_public === true,
            title: data.title,
            category: data.category,
            date: data.event_date,
            location: data.location,
            organizer: data.organizer,
            registrationUrl: data.registration_url,
            image: data.image_url || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
            description: data.description,
          }
          setEvents((prev) => [created, ...prev])
          setFormData(INITIAL_FORM)
          setEditingEventId(null)
          setIsAddOpen(false)
        }
      }
    } catch (err) {
      console.error('[CampusMate] Exception saving event:', err)
      alert('Could not save event. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. CAMPUSCONNECT HERO BANNER ── */}
      <div className="workspace-page-header border-b border-[var(--cm-border)] bg-[var(--cm-surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <div className="workspace-page-kicker"><span /> CAMPUSCONNECT · CAMPUS LIFE</div>
              <h1 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--cm-text)]">
                There’s a place for your thing.
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-[var(--cm-muted)] leading-relaxed">
                Connect with flagship technical chapters, cultural councils, and athletic teams. Discover upcoming college fests and workshops.
              </p>
              <p className="text-xs text-[var(--cm-muted)]">
                Saving an event is local to this device and does not register you. Use the organizer&apos;s registration link when available.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingEventId(null)
                setFormData(INITIAL_FORM)
                setIsAddOpen(true)
              }}
              className="workspace-primary-button cursor-pointer"
            >
              <Plus size={16} /> Host an Event
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 shadow-xs">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── 2. SEARCH & EVENT FILTER TABS ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-1 text-xs">
            {['All Events', 'Technical', 'Cultural', 'Sports'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedFilter(tab)}
                className={`rounded-lg px-3.5 py-1.5 font-bold transition cursor-pointer ${
                  selectedFilter === tab
                    ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
                    : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]"
            />
            <input
              type="text"
              placeholder="Search hackathons, venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] pl-9 pr-3 py-2 text-xs text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-accent)] focus:outline-none transition shadow-2xs"
            />
          </div>
        </div>

        {/* ── 3. EVENTS GRID OR EMPTY STATE ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-xs font-semibold text-[var(--cm-muted)]">
            <Loader2 size={20} className="animate-spin text-[var(--cm-accent)]" />
            Loading campus events from database...
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={events.length === 0 ? "No campus events scheduled" : "No events match this filter"}
            description={
              events.length === 0
                ? "There are no upcoming college workshops, hackathons, or fests right now. Be the first to share one with fellow students!"
                : "Try searching with different keywords or choosing 'All Events' above."
            }
            action={
              events.length === 0
                ? {
                    label: "Host an Event",
                    onClick: () => setIsAddOpen(true),
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const { month, day } = formatDateBlock(event.date)
              const isSaved = savedEvents.has(event.id)

              return (
                <div
                  key={event.id}
                  className="overflow-hidden rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-xs hover:shadow-md transition flex flex-col justify-between group"
                >
                  <div>
                    {/* Event Banner */}
                    <div className="relative h-44 w-full overflow-hidden bg-[var(--cm-secondary)]">
                      <img
                        src={event.image}
                        alt={event.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Date Badge */}
                      <div className="absolute top-3 left-3 flex flex-col items-center justify-center rounded-2xl bg-white/95 dark:bg-stone-900/95 px-3 py-1.5 shadow-md">
                        <span className="text-[10px] font-extrabold uppercase text-[var(--cm-accent)]">
                          {month}
                        </span>
                        <span className="font-['Poppins'] text-base font-extrabold text-[var(--cm-text)] leading-tight">
                          {day}
                        </span>
                      </div>

                      {/* Category Badge */}
                      <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-xs px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                        {event.category}
                      </span>

                      {/* Organizer bottom tag */}
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-[11px] font-bold text-white/90 truncate">
                          Hosted by {event.organizer}
                        </p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-3">
                      <h3 className="font-['Poppins'] text-base font-extrabold text-[var(--cm-text)] group-hover:text-[var(--cm-accent)] transition line-clamp-1">
                        {event.title}
                      </h3>
                      <p className="text-xs text-[var(--cm-muted)] line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>

                      <div className="pt-2 space-y-1.5 border-t border-[var(--cm-border)]/60 text-xs text-[var(--cm-muted)]">
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-[var(--cm-accent)] shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-[var(--cm-accent)] shrink-0" />
                          <span>{formatTime(event.date)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer RSVP / Details / Actions */}
                  <div className="p-5 pt-0 flex items-center justify-between gap-2 border-t border-[var(--cm-border)]/40 mt-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(event)}
                        className="text-xs font-bold text-[var(--cm-muted)] hover:text-[var(--cm-text)] cursor-pointer py-1"
                      >
                        View Details
                      </button>

                      {user?.id && (event.created_by === user.id || (isAdmin && event.isPublic)) && (
                        <div className="flex items-center gap-1 border-l border-[var(--cm-border)]/60 pl-2">
                          <button
                            type="button"
                            onClick={(e) => handleEditClick(event, e)}
                            className="p-1 rounded-lg text-[var(--cm-muted)] hover:text-[var(--cm-accent)] hover:bg-[var(--cm-secondary)] cursor-pointer transition"
                            title="Edit Event"
                            aria-label="Edit Event"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteEvent(event.id, e)}
                            className="p-1 rounded-lg text-[var(--cm-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition"
                            title="Delete Event"
                            aria-label="Delete Event"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSavedEvent(event.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        isSaved
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'workspace-primary-button'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <CheckCircle size={13} /> Saved on this device
                        </>
                      ) : (
                        'Save Event'
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 4. FLAGSHIP SOCIETIES & CLUBS ── */}
        <div className="space-y-6 pt-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--cm-accent)]">
              <Users size={13} /> Active Student Organizations
            </div>
            <h2 className="font-['Poppins'] text-2xl font-extrabold text-[var(--cm-text)]">
              Student Councils & Societies ⚡
            </h2>
            <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
              Connect with chapter leads and audition during orientation season.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CLUBS.map((club) => (
              <div
                key={club.name}
                className="overflow-hidden rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-4 shadow-2xs hover:shadow-sm transition group"
              >
                <div className="relative h-28 w-full overflow-hidden rounded-xl bg-[var(--cm-secondary)] mb-3">
                  <img
                    src={club.image}
                    alt={club.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition"
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white uppercase">
                    {club.badge}
                  </span>
                </div>
                <h4 className="font-['Poppins'] text-sm font-extrabold text-[var(--cm-text)] line-clamp-1">
                  {club.name}
                </h4>
                <p className="text-[11px] text-[var(--cm-muted)] mt-1 line-clamp-2">
                  {club.tagline}
                </p>
                <span className="mt-3 block text-[10px] font-bold uppercase text-[var(--cm-accent)]">
                  {club.members}
                </span>
              </div>
            ))}
          </div>

          {/* Club joining steps */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            {CLUB_PATHWAY.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 shadow-2xs"
              >
                <span className="font-mono text-xs font-bold text-[var(--cm-accent)]">
                  {item.step}
                </span>
                <h4 className="mt-1 font-bold text-xs text-[var(--cm-text)]">{item.title}</h4>
                <p className="mt-1 text-[11px] text-[var(--cm-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOST / EDIT EVENT MODAL ── */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false)
          setEditingEventId(null)
          setFormData(INITIAL_FORM)
        }}
        title={editingEventId ? 'Edit Campus Event' : 'Host a Campus Event'}
      >
        <form onSubmit={handleSaveEvent} className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Event Title</label>
            <input
              type="text"
              required
              placeholder="e.g. HackDTU 2026 Hackathon"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="workshop">Workshop</option>
                <option value="hackathon">Hackathon</option>
                <option value="fest">Fest / Cultural</option>
                <option value="seminar">Seminar</option>
                <option value="sports">Sports Tournament</option>
                <option value="cultural">Cultural</option>
                <option value="academic">Academic</option>
                <option value="technical">Technical</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Host / Organizer</label>
              <input
                type="text"
                placeholder="e.g. ACM Student Chapter"
                value={formData.organizer}
                onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Start Time</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Venue / Location</label>
            <input
              type="text"
              required
              placeholder="e.g. B.R. Ambedkar Auditorium / Online"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Registration URL (Optional)</label>
            <input
              type="url"
              placeholder="https://unstop.com/... or Google Form"
              value={formData.registrationUrl}
              onChange={(e) => setFormData({ ...formData, registrationUrl: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Description & Overview</label>
            <textarea
              rows={3}
              placeholder="Describe rules, eligible batches, and prize pools..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--cm-border)]">
            <button
              type="button"
              onClick={() => {
                setIsAddOpen(false)
                setEditingEventId(null)
                setFormData(INITIAL_FORM)
              }}
              disabled={submitting}
              className="rounded-xl border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="workspace-primary-button disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? editingEventId
                  ? 'Saving...'
                  : 'Publishing...'
                : editingEventId
                ? 'Save Changes'
                : 'Publish Event'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── EVENT DETAILS MODAL ── */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title={selectedEvent.title}
        >
          <div className="space-y-4">
            <div className="relative h-48 w-full overflow-hidden rounded-2xl bg-[var(--cm-secondary)]">
              <img
                src={selectedEvent.image}
                alt={selectedEvent.title}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cm-border)]/60 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-accent)]">
                  Organized by
                </span>
                <p className="font-bold text-sm text-[var(--cm-text)]">
                  {selectedEvent.organizer}
                </p>
              </div>

              <span className="rounded-full bg-[var(--cm-secondary)] px-3 py-1 text-xs font-bold uppercase text-[var(--cm-muted)]">
                {selectedEvent.category}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[var(--cm-text)] leading-relaxed">
              {selectedEvent.description}
            </p>
            <p className="text-xs text-[var(--cm-muted)]">
              In-app RSVP is not available. Saving this event does not register you.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[var(--cm-bg)] p-3.5 rounded-2xl border border-[var(--cm-border)]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--cm-muted)]">Event Date</span>
                <p className="font-bold text-[var(--cm-text)] mt-0.5">{formatDate(selectedEvent.date)}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--cm-muted)]">Time & Venue</span>
                <p className="font-bold text-[var(--cm-text)] mt-0.5 truncate">{formatTime(selectedEvent.date)} · {selectedEvent.location}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--cm-border)]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-xl border border-[var(--cm-border)] px-4 py-2 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] cursor-pointer"
                >
                  Close
                </button>

                {user?.id && (selectedEvent.created_by === user.id || (isAdmin && selectedEvent.isPublic)) && (
                  <div className="flex items-center gap-1 border-l border-[var(--cm-border)]/60 pl-2">
                    <button
                      type="button"
                      onClick={() => {
                        const ev = selectedEvent
                        setSelectedEvent(null)
                        handleEditClick(ev)
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--cm-border)] px-3 py-1.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] cursor-pointer transition"
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(selectedEvent.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/60 cursor-pointer transition"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedEvent.registrationUrl && (
                  <a
                    href={selectedEvent.registrationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3 py-2 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]"
                  >
                    Open Link <ExternalLink size={13} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => toggleSavedEvent(selectedEvent.id)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition ${
                    savedEvents.has(selectedEvent.id)
                      ? 'bg-emerald-600 text-white'
                      : 'workspace-primary-button'
                  }`}
                >
                  {savedEvents.has(selectedEvent.id) ? 'Saved on this device ✓' : 'Save Event'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Events
