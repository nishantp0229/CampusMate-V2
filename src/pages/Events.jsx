// src/pages/Events.jsx — CampusConnect events & student clubs inspired by Campus Compass

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  CalendarDays,
  Plus,
  Search,
  MapPin,
  Clock,
  Users,
  CheckCircle,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_EVENTS } from '../utils/mockData'

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
  if (c.includes('cultural') || c.includes('art') || c.includes('music')) return 'Cultural'
  if (c.includes('sports') || c.includes('cricket') || c.includes('football')) return 'Sports'
  return 'Technical'
}

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

const formatDateBlock = (dateStr) => {
  const d = new Date(dateStr)
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
  }
}

const INITIAL_FORM = {
  title: '',
  category: 'Technical',
  date: '',
  time: '10:00',
  location: '',
  description: '',
}

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-none transition'
const LABEL_CLASS = 'mb-1 block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider'

function Events() {
  const { state } = useLocation()
  const [events, setEvents] = useState(MOCK_EVENTS)
  const [selectedFilter, setSelectedFilter] = useState('All Events')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(() =>
    MOCK_EVENTS.find((e) => e.id === state?.selectedId) || null
  )
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [registeredEvents, setRegisteredEvents] = useState(
    new Set(MOCK_EVENTS.filter((e) => e.isRegistered).map((e) => e.id))
  )

  const toggleRSVP = (eventId) => {
    setRegisteredEvents((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return next
    })
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

  const handleAddEvent = (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.location.trim()) return

    const dateTime = formData.date
      ? `${formData.date}T${formData.time || '10:00'}`
      : new Date().toISOString()

    const newEvent = {
      id: `event-${Date.now()}`,
      title: formData.title.trim(),
      category: formData.category.toLowerCase(),
      date: new Date(dateTime).toISOString(),
      location: formData.location.trim(),
      image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
      description: formData.description.trim() || 'Exciting campus event open to all students.',
      organizer: 'Student Activity Centre',
      attendees: 1,
      isRegistered: true,
    }

    setEvents((prev) => [newEvent, ...prev])
    setRegisteredEvents((prev) => new Set(prev).add(newEvent.id))
    setFormData(INITIAL_FORM)
    setIsAddOpen(false)
  }

  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. CAMPUSCONNECT HERO HEADER (Campus Compass Clubs style) ── */}
      <div className="workspace-page-header border-b border-[var(--cm-border)] bg-[var(--cm-surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <div className="workspace-page-kicker"><span /> CAMPUSCONNECT / DEMO DATA</div>
              <h1 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--cm-text)]">
                There’s a place for your thing.
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-[var(--cm-muted)] leading-relaxed">
                Connect with flagship technical chapters, cultural councils, and athletic teams. Register for campus events with one tap.
              </p>
            </div>

            <button
              onClick={() => setIsAddOpen(true)}
              className="workspace-primary-button"
            >
              <Plus size={16} /> Submit College Event
            </button>
          </div>

          {/* Interactive Club Wonder Cards Rail (Campus Compass style) */}
          <div className="pt-8 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Flagship Student Societies & Teams:
              </p>
              <span className="text-xs font-semibold text-[var(--cm-accent)]">
                Recruiting Freshers & Juniors
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CLUBS.map((club, idx) => (
                <div
                  key={idx}
                  className="group overflow-hidden rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] hover:border-[var(--cm-accent)]/80 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="relative h-32 w-full overflow-hidden">
                    <img
                      src={club.image}
                      alt={club.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                        {club.category}
                      </span>
                    </div>
                    <div className="absolute top-2.5 right-2.5">
                      <span className="rounded-md bg-[var(--cm-accent)] text-[var(--cm-accent-text)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-xs">
                        {club.badge}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-['Poppins'] text-sm font-bold text-[var(--cm-text)] group-hover:text-[var(--cm-accent)] transition">
                        {club.name}
                      </h3>
                      <p className="text-xs text-[var(--cm-muted)] line-clamp-2 leading-relaxed mt-1">
                        {club.tagline}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--cm-border)]/60 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {club.members}
                      </span>
                      <span className="text-[var(--cm-muted)] font-semibold group-hover:underline">
                        Explore →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
        {/* ── 2. "FROM CURIOUS FRESHER TO ACTIVE MEMBER" PATHWAY (Campus Compass) ── */}
        <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-accent)]">
              Senior Advice & Roadmaps
            </span>
            <h2 className="font-['Poppins'] text-xl sm:text-2xl font-extrabold text-[var(--cm-text)]">
              From Curious Fresher to Active Club Member 🚀
            </h2>
            <p className="text-xs sm:text-sm text-[var(--cm-muted)] mt-1">
              How recruitment works at university societies — follow the four proven steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CLUB_PATHWAY.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)]/60 p-4.5 space-y-2 relative"
              >
                <span className="font-mono text-2xl font-extrabold text-[var(--cm-accent)]/50">
                  {item.step}
                </span>
                <h4 className="font-['Poppins'] text-sm font-bold text-[var(--cm-text)]">
                  {item.title}
                </h4>
                <p className="text-xs text-[var(--cm-muted)] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. SEARCH & CATEGORY FILTERS ── */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-1 text-xs shadow-2xs">
            {['All Events', 'Technical', 'Cultural', 'Sports'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedFilter(cat)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  selectedFilter === cat
                    ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
                    : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hackathons, tournaments, workshops..."
              className="w-full rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] py-2.5 pr-4 pl-10 text-xs text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-accent)] focus:outline-none transition shadow-2xs"
            />
          </div>
        </div>

        {/* ── 4. EVENT DISCOVERY GRID (Real High-Res Imagery) ── */}
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events match your criteria"
            description="Try searching for another keyword or select 'All Events' above."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const { month, day } = formatDateBlock(event.date)
              const group = getCategoryGroup(event.category)
              const isRsvp = registeredEvents.has(event.id)

              return (
                <div
                  key={event.id}
                  className="flex flex-col overflow-hidden rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-xs hover:border-[var(--cm-accent)]/80 hover:shadow-md transition-all duration-300 group"
                >
                  {/* Card Banner Image */}
                  <div className="relative h-48 w-full overflow-hidden bg-[var(--cm-secondary)]">
                    <img
                      src={event.image}
                      alt={event.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />

                    {/* Date badge */}
                    <div className="absolute top-3.5 left-3.5 rounded-xl border border-white/20 bg-black/60 px-3 py-1.5 text-center shadow-lg backdrop-blur-md text-white">
                      <span className="block text-[9px] font-extrabold uppercase text-[#dce4b2] leading-none">
                        {month}
                      </span>
                      <span className="block font-['Poppins'] text-lg font-black leading-tight">
                        {day}
                      </span>
                    </div>

                    <div className="absolute top-3.5 right-3.5">
                      <span className="rounded-lg bg-[var(--cm-accent)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cm-accent-text)] shadow-xs">
                        {group}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="flex flex-1 flex-col justify-between p-5 sm:p-6 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-[var(--cm-muted)]">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={12} className="text-[var(--cm-accent)]" /> {formatTime(event.date)}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 truncate font-medium">
                          <MapPin size={12} className="shrink-0 text-[var(--cm-accent)]" /> {event.location}
                        </span>
                      </div>

                      <h3 className="font-['Poppins'] text-base font-bold text-[var(--cm-text)] leading-snug line-clamp-1 group-hover:text-[var(--cm-accent)] transition">
                        {event.title}
                      </h3>

                      <p className="text-xs text-[var(--cm-muted)] line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-[var(--cm-border)]/60">
                      <div className="flex items-center justify-between text-xs text-[var(--cm-muted)]">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <Users size={13} /> {event.attendees || 0} Attending
                        </span>
                        <span className="text-[11px] font-medium truncate max-w-[140px]">
                          {event.organizer || 'Student Committee'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="flex-1 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] py-2.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => toggleRSVP(event.id)}
                          className={`rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                            isRsvp
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] hover:opacity-90'
                          }`}
                        >
                          {isRsvp ? (
                            <>
                              <CheckCircle size={14} /> Registered
                            </>
                          ) : (
                            'RSVP'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── EVENT DETAILS MODAL ── */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title={selectedEvent.title}
        >
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-[var(--cm-border)]">
              <img
                src={selectedEvent.image}
                alt={selectedEvent.title}
                className="h-52 w-full object-cover"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3">
                <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Date & Timing</span>
                <p className="mt-1 font-bold text-[var(--cm-text)]">
                  {formatDate(selectedEvent.date)} at {formatTime(selectedEvent.date)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3">
                <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Campus Venue</span>
                <p className="mt-1 font-bold text-[var(--cm-text)] truncate">
                  {selectedEvent.location}
                </p>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">About This Event</span>
              <p className="mt-1 text-xs text-[var(--cm-text)] leading-relaxed">
                {selectedEvent.description}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-secondary)]/50 p-4 text-xs flex items-center justify-between">
              <div>
                <p className="font-bold text-[var(--cm-text)]">Organized by {selectedEvent.organizer || 'DTU Council'}</p>
                <p className="text-[11px] text-[var(--cm-muted)]">{selectedEvent.attendees || 0} students attending</p>
              </div>
              <button
                onClick={() => toggleRSVP(selectedEvent.id)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  registeredEvents.has(selectedEvent.id)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
                }`}
              >
                {registeredEvents.has(selectedEvent.id) ? 'Registered ✓' : 'Register Now'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── ADD EVENT MODAL ── */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Submit Campus Event">
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Event Name</label>
            <input
              type="text"
              required
              placeholder="e.g. RoboWars 2026 Championship"
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
                <option value="Technical">Technical</option>
                <option value="Cultural">Cultural</option>
                <option value="Sports">Sports</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Location / Venue</label>
              <input
                type="text"
                required
                placeholder="e.g. Open Air Theatre"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
              <label className={LABEL_CLASS}>Time</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Event Description</label>
            <textarea
              rows={3}
              placeholder="Provide event details, prizes, eligibility, and rules..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--cm-border)]">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-xl border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="workspace-primary-button"
            >
              Publish Event
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Events
