import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CalendarDays, Plus, Search, MapPin, Clock } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_EVENTS } from '../utils/mockData'

const makeCover = (label) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240"><rect width="600" height="240" fill="#E7EEED"/><circle cx="510" cy="45" r="90" fill="#4A5C6A" fill-opacity="0.18"/><circle cx="95" cy="205" r="70" fill="#253745" fill-opacity="0.12"/><text x="32" y="132" font-family="sans-serif" font-size="26" font-weight="700" fill="#172B36" opacity="0.8">${label}</text></svg>`
  )}`

const CATEGORY_INFO = {
  Technical: { variant: 'primary', cover: makeCover('Technical Event') },
  Cultural: { variant: 'default', cover: makeCover('Cultural Event') },
  Sports: { variant: 'success', cover: makeCover('Sports Event') },
}

const getCategoryGroup = (category) => {
  if (category === 'cultural' || category === 'Cultural') return 'Cultural'
  if (category === 'sports' || category === 'Sports') return 'Sports'
  return 'Technical'
}

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

const INITIAL_FORM = { title: '', category: 'Technical', date: '', time: '10:00', location: '', image: '', description: '' }
const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-2 text-sm text-[var(--cm-text)] focus:border-[var(--cm-muted)] focus:outline-none'
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-[var(--cm-muted)]'

function Events() {
  const { state } = useLocation()
  const [events, setEvents] = useState(MOCK_EVENTS)
  const [selectedFilter, setSelectedFilter] = useState('All Events')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(() => MOCK_EVENTS.find((e) => e.id === state?.selectedId) || null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM)

  const filteredEvents = events
    .filter((event) => {
      const group = getCategoryGroup(event.category)
      if (selectedFilter !== 'All Events' && group !== selectedFilter) return false
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      return (
        event.title.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q) ||
        event.description?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const handleAddEvent = (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.location.trim()) return

    const dateTime = formData.date ? `${formData.date}T${formData.time || '10:00'}` : new Date().toISOString()
    const newEvent = {
      id: `event-${Date.now()}`,
      title: formData.title.trim(),
      category: formData.category,
      date: new Date(dateTime).toISOString(),
      location: formData.location.trim(),
      image: formData.image.trim(),
      description: formData.description.trim() || 'Campus event open to all students.',
      organizer: 'Campus Community',
    }

    setEvents((prev) => [newEvent, ...prev])
    setFormData(INITIAL_FORM)
    setIsAddOpen(false)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--cm-border)] pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-['Poppins'] text-2xl font-semibold text-[var(--cm-text)]">CampusConnect</h1>
          <p className="mt-1 text-sm text-[var(--cm-muted)]">
            Discover upcoming technical, cultural, and sports events on campus.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[var(--cm-accent)] px-4 py-2 text-xs font-medium text-[var(--cm-accent-text)] transition hover:opacity-90"
        >
          <Plus size={15} /> Add Event
        </button>
      </div>

      {/* Search & Category Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events or venue..."
            className="w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] py-2 pl-9 pr-3 text-sm text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-muted)] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] p-1">
          {['All Events', 'Technical', 'Cultural', 'Sports'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedFilter(tab)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                selectedFilter === tab
                  ? 'bg-[var(--cm-secondary)] text-[var(--cm-text)]'
                  : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events found"
          description="Try clearing your search or selecting another category."
          action={{ label: 'Add Event', onClick: () => setIsAddOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const category = getCategoryGroup(event.category)
            const info = CATEGORY_INFO[category]
            return (
              <div
                key={event.id}
                className="flex flex-col overflow-hidden rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] transition hover:border-[var(--cm-muted)]"
              >
                <img src={event.image || info.cover} alt={event.title} className="h-36 w-full border-b border-[var(--cm-border)] object-cover" />
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <Badge variant={info.variant}>{category}</Badge>
                    <h3 className="mt-2.5 line-clamp-1 font-['Poppins'] text-base font-semibold text-[var(--cm-text)]">
                      {event.title}
                    </h3>
                    <div className="mt-2.5 space-y-1.5 text-xs text-[var(--cm-muted)]">
                      <p className="flex items-center gap-1.5">
                        <Clock size={13} />
                        {formatDate(event.date)} · {formatTime(event.date)}
                      </p>
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin size={13} className="shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(event)}
                    className="mt-4 w-full rounded-md border border-[var(--cm-border)] bg-[var(--cm-secondary)] py-2 text-xs font-medium text-[var(--cm-text)] transition hover:opacity-90"
                  >
                    View Details
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <Modal isOpen={true} onClose={() => setSelectedEvent(null)} title={selectedEvent.title} size="md">
          <div className="space-y-4">
            <img
              src={selectedEvent.image || CATEGORY_INFO[getCategoryGroup(selectedEvent.category)].cover}
              alt={selectedEvent.title}
              className="h-44 w-full rounded-lg border border-[var(--cm-border)] object-cover"
            />
            <div className="flex items-center justify-between">
              <Badge variant={CATEGORY_INFO[getCategoryGroup(selectedEvent.category)].variant}>
                {getCategoryGroup(selectedEvent.category)}
              </Badge>
              {selectedEvent.organizer && (
                <span className="text-xs text-[var(--cm-muted)]">By {selectedEvent.organizer}</span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-[var(--cm-text)]">{selectedEvent.description}</p>
            <div className="space-y-1.5 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] p-3 text-xs text-[var(--cm-muted)]">
              <p className="flex items-center gap-2">
                <Clock size={14} />
                {formatDate(selectedEvent.date)} at {formatTime(selectedEvent.date)}
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={14} />
                {selectedEvent.location}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Event Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Event" size="sm">
        <form onSubmit={handleAddEvent} className="space-y-3.5">
          <div>
            <label className={LABEL_CLASS}>Event Name *</label>
            <input type="text" required placeholder="e.g. Robotics Workshop" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={INPUT_CLASS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Category</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={INPUT_CLASS}>
                <option value="Technical">Technical</option>
                <option value="Cultural">Cultural</option>
                <option value="Sports">Sports</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Location *</label>
              <input type="text" required placeholder="e.g. Main Auditorium" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className={INPUT_CLASS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Date</label>
              <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Time</label>
              <input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className={INPUT_CLASS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Image URL (Optional)</label>
            <input type="url" placeholder="https://..." value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea rows={2} placeholder="Brief event details..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${INPUT_CLASS} resize-none`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsAddOpen(false)} className="rounded-lg border border-[var(--cm-border)] px-4 py-2 text-xs font-medium text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]">Cancel</button>
            <button type="submit" className="rounded-lg bg-[var(--cm-accent)] px-4 py-2 text-xs font-medium text-[var(--cm-accent-text)] hover:opacity-90">Add Event</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Events
