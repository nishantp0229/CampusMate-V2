// src/pages/Events.jsx — CampusConnect Events Hub module
// Displays college events, workshops, hackathons with search, category filters and registration.

import { useState, useMemo } from 'react'
import {
  CalendarDays, Plus, Search, MapPin, Users,
  ExternalLink, Clock, Check
} from 'lucide-react'
import Badge, { categoryBadge } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_EVENTS } from '../utils/mockData'

const CATEGORIES = [
  { id: 'all', label: 'All Events' },
  { id: 'workshop', label: 'Workshops' },
  { id: 'hackathon', label: 'Hackathons' },
  { id: 'fest', label: 'Fests' },
  { id: 'seminar', label: 'Seminars' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'sports', label: 'Sports' },
]

function Events() {
  const [events, setEvents] = useState(MOCK_EVENTS)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'workshop',
    date: '',
    location: '',
    organizer: '',
    registrationUrl: '',
  })
  const [formError, setFormError] = useState('')

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        if (selectedCategory !== 'all' && ev.category !== selectedCategory) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchTitle = ev.title.toLowerCase().includes(q)
          const matchDesc = ev.description?.toLowerCase().includes(q)
          const matchLoc = ev.location?.toLowerCase().includes(q)
          if (!matchTitle && !matchDesc && !matchLoc) return false
        }
        return true
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [events, selectedCategory, searchQuery])

  // Handlers
  const handleToggleRegistration = (id) => {
    setEvents(prev =>
      prev.map(ev =>
        ev.id === id
          ? {
              ...ev,
              isRegistered: !ev.isRegistered,
              attendees: ev.isRegistered ? ev.attendees - 1 : ev.attendees + 1,
            }
          : ev
      )
    )
    if (selectedEvent && selectedEvent.id === id) {
      setSelectedEvent(prev => ({
        ...prev,
        isRegistered: !prev.isRegistered,
        attendees: prev.isRegistered ? prev.attendees - 1 : prev.attendees + 1,
      }))
    }
  }

  const handleOpenDetail = (ev) => {
    setSelectedEvent(ev)
    setIsDetailOpen(true)
  }

  const handleOpenAdd = () => {
    setFormData({
      title: '',
      description: '',
      category: 'workshop',
      date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      location: '',
      organizer: 'Student Body',
      registrationUrl: '',
    })
    setFormError('')
    setIsAddOpen(true)
  }

  const handleAddSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setFormError('Event title is required.')
      return
    }
    if (!formData.location.trim()) {
      setFormError('Event location is required.')
      return
    }

    const newEvent = {
      id: `event-${Date.now()}`,
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
      location: formData.location.trim(),
      organizer: formData.organizer.trim() || 'Campus Community',
      registrationUrl: formData.registrationUrl.trim() || '#',
      isRegistered: false,
      attendees: 1,
    }

    setEvents(prev => [newEvent, ...prev])
    setIsAddOpen(false)
  }

  const formatEventDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-[#242B3A] dark:text-[#F1F1FC]"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            CampusConnect
          </h1>
          <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] mt-1">
            Explore workshops, hackathons, sports events and cultural fests.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#A9C9FF] text-white rounded-xl font-medium text-sm hover:bg-[#8BB8F8] transition-colors shadow-sm"
        >
          <Plus size={16} />
          Create Event
        </button>
      </div>

      {/* ══ SEARCH & CATEGORIES BAR ══════════════════════════════ */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737B8C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events by title, description or venue..."
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#252A3C] border border-[#E2E8F0] dark:border-white/[0.07] rounded-2xl text-sm text-[#242B3A] dark:text-[#F1F1FC] placeholder-[#737B8C] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50 shadow-sm"
          />
        </div>

        {/* Category horizontal scrolling tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-[#A9C9FF] text-white shadow-sm'
                  : 'bg-white dark:bg-[#252A3C] text-[#737B8C] dark:text-[#A0A8B8] border border-[#E2E8F0] dark:border-white/[0.07] hover:text-[#242B3A] dark:hover:text-[#F1F1FC]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ EVENTS GRID ══════════════════════════════════════════ */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events found"
          description="We couldn't find any events matching your current filters."
          action={{ label: 'Host a New Event', onClick: handleOpenAdd }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map(ev => {
            const catBadge = categoryBadge(ev.category)

            return (
              <div
                key={ev.id}
                className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Badge variant={catBadge.variant}>{catBadge.label}</Badge>
                    <span className="text-[11px] text-[#737B8C] dark:text-[#A0A8B8] flex items-center gap-1">
                      <Users size={12} /> {ev.attendees} going
                    </span>
                  </div>

                  <h3
                    className="font-semibold text-base text-[#242B3A] dark:text-[#F1F1FC] mb-2 line-clamp-1"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {ev.title}
                  </h3>

                  <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] line-clamp-2 mb-4 leading-relaxed">
                    {ev.description}
                  </p>

                  <div className="space-y-1.5 text-xs text-[#737B8C] dark:text-[#A0A8B8] mb-5">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-[#5B9BF8]" />
                      <span>{formatEventDate(ev.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-[#FF9BAA]" />
                      <span className="truncate">{ev.location}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="pt-3 border-t border-[#E2E8F0] dark:border-white/[0.05] flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenDetail(ev)}
                    className="text-xs font-medium text-[#5B9BF8] hover:underline"
                  >
                    Details
                  </button>

                  <button
                    onClick={() => handleToggleRegistration(ev.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      ev.isRegistered
                        ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20'
                        : 'bg-[#A9C9FF] text-white hover:bg-[#8BB8F8]'
                    }`}
                  >
                    {ev.isRegistered ? (
                      <>
                        <Check size={13} />
                        Registered
                      </>
                    ) : (
                      'RSVP / Register'
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ EVENT DETAILS MODAL ══════════════════════════════════ */}
      {selectedEvent && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={selectedEvent.title}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={categoryBadge(selectedEvent.category).variant}>
                {categoryBadge(selectedEvent.category).label}
              </Badge>
              <span className="text-xs text-[#737B8C] dark:text-[#A0A8B8]">
                Organized by: <strong className="text-[#242B3A] dark:text-[#F1F1FC]">{selectedEvent.organizer}</strong>
              </span>
            </div>

            <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] leading-relaxed">
              {selectedEvent.description}
            </p>

            <div className="p-3.5 rounded-xl bg-[#F7F8FC] dark:bg-[#171A29] space-y-2 text-xs text-[#242B3A] dark:text-[#F1F1FC]">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[#5B9BF8]" />
                <span>{formatEventDate(selectedEvent.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-[#FF9BAA]" />
                <span>{selectedEvent.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[#6BCB9A]" />
                <span>{selectedEvent.attendees} students interested / attending</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3">
              {selectedEvent.registrationUrl && selectedEvent.registrationUrl !== '#' ? (
                <a
                  href={selectedEvent.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#5B9BF8] hover:underline"
                >
                  Official Event Portal <ExternalLink size={12} />
                </a>
              ) : <span />}

              <button
                onClick={() => handleToggleRegistration(selectedEvent.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                  selectedEvent.isRegistered
                    ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200'
                    : 'bg-[#A9C9FF] text-white hover:bg-[#8BB8F8]'
                }`}
              >
                {selectedEvent.isRegistered ? (
                  <>
                    <Check size={14} />
                    Registered (Click to cancel)
                  </>
                ) : (
                  'Confirm RSVP'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ ADD EVENT MODAL ══════════════════════════════════════ */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Host a College Event"
        size="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-3.5">
          {formError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. AI & Robotics Symposium"
              required
              className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-xs text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              >
                <option value="workshop">Workshop</option>
                <option value="hackathon">Hackathon</option>
                <option value="fest">Fest</option>
                <option value="seminar">Seminar</option>
                <option value="cultural">Cultural</option>
                <option value="sports">Sports</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-xs text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Location / Venue *
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Auditorium Hall B"
                required
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Organizer Club / Dept
              </label>
              <input
                type="text"
                value={formData.organizer}
                onChange={(e) => setFormData(f => ({ ...f, organizer: e.target.value }))}
                placeholder="e.g. IEEE Student Branch"
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Registration URL (Optional)
            </label>
            <input
              type="url"
              value={formData.registrationUrl}
              onChange={(e) => setFormData(f => ({ ...f, registrationUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="Event schedule, prizes, eligibility..."
              className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.1] text-xs font-medium text-[#737B8C]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#A9C9FF] text-white rounded-xl text-xs font-medium hover:bg-[#8BB8F8] transition-colors"
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
