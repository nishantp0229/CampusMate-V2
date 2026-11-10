import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, Search, Bookmark, Bell, Upload, SlidersHorizontal } from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_LOST_FOUND, MOCK_USER, ITEM_CATEGORY_IMAGES } from '../utils/mockData'

const TABS = ['All', 'Lost', 'Found', 'Saved']
const CATEGORIES = ['All', 'Electronics', 'Accessories', 'Documents', 'Books', 'Other']
const LOCATIONS = ['All', 'Library', 'Canteen', 'Hostel', 'Labs', 'Auditorium']
const STATUS_OPTIONS = ['All', 'Active', 'Resolved']
const INITIAL_FORM = { type: 'lost', itemName: '', description: '', category: 'Electronics', locationTag: 'Library', location: '', dateOccurred: '', imageUrl: '' }

const inputCls = 'w-full rounded border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-2 text-sm text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-muted)] focus:outline-none'
const labelCls = 'mb-1 block text-xs font-medium text-[var(--cm-muted)]'
const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function FilterGroup({ title, options, value, onChange }) {
  return (
    <div className="border-b border-[var(--cm-border)] pb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--cm-muted)]">{title}</h3>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`block w-full rounded px-2.5 py-1.5 text-left text-sm transition ${
              value === opt
                ? 'bg-[var(--cm-secondary)] font-medium text-[var(--cm-text)]'
                : 'text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]/60 hover:text-[var(--cm-text)]'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function LostFound({ items = MOCK_LOST_FOUND, onAddItem, onUpdateItem }) {
  const { state } = useLocation()
  const [activeTab, setActiveTab] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [locationTag, setLocationTag] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [bookmarkedIds, setBookmarkedIds] = useState(['lf-1'])
  const [showActivity, setShowActivity] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 'n-1', text: 'Your listing "OnePlus Nord (Black)" is live in Library.', time: 'Just now' },
  ])
  const [selectedItem, setSelectedItem] = useState(() => items.find((i) => i.id === state?.selectedId) || null)
  const [isFormOpen, setIsFormOpen] = useState(Boolean(state?.openAdd))
  const [formData, setFormData] = useState(INITIAL_FORM)

  const addNotification = (text) =>
    setNotifications((prev) => [{ id: `n-${Date.now()}`, text, time: 'Just now' }, ...prev])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (file) setFormData((prev) => ({ ...prev, imageUrl: URL.createObjectURL(file) }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.itemName.trim() || !formData.location.trim()) return

    const newItem = {
      id: `lf-${Date.now()}`,
      type: formData.type,
      itemName: formData.itemName.trim(),
      description: formData.description.trim() || 'No additional details provided.',
      category: formData.category,
      locationTag: formData.locationTag,
      location: formData.location.trim(),
      dateOccurred: formData.dateOccurred ? new Date(formData.dateOccurred).toISOString() : new Date().toISOString(),
      imageUrl: formData.imageUrl || ITEM_CATEGORY_IMAGES[formData.category] || ITEM_CATEGORY_IMAGES.Other,
      isResolved: false,
      userId: MOCK_USER.id,
    }

    onAddItem?.(newItem)
    addNotification(`Posted ${newItem.type} item "${newItem.itemName}" in ${newItem.locationTag}.`)
    setFormData(INITIAL_FORM)
    setIsFormOpen(false)
  }

  const toggleBookmark = (id, e) => {
    e?.stopPropagation()
    setBookmarkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleFoundResponse = (item) => {
    onUpdateItem?.(item.id, { foundReported: true })
    setSelectedItem((prev) => (prev?.id === item.id ? { ...prev, foundReported: true } : prev))
    addNotification(`Finder response recorded for "${item.itemName}".`)
  }

  const handleMarkReturned = (item) => {
    onUpdateItem?.(item.id, { isResolved: true })
    setSelectedItem((prev) => (prev?.id === item.id ? { ...prev, isResolved: true } : prev))
    addNotification(`Marked "${item.itemName}" as returned.`)
  }

  const filteredItems = items.filter((item) => {
    if (activeTab === 'Lost' && item.type !== 'lost') return false
    if (activeTab === 'Found' && item.type !== 'found') return false
    if (activeTab === 'Saved' && !bookmarkedIds.includes(item.id)) return false
    if (statusFilter === 'Active' && item.isResolved) return false
    if (statusFilter === 'Resolved' && !item.isResolved) return false
    if (category !== 'All' && item.category !== category) return false
    if (locationTag !== 'All' && item.locationTag !== locationTag) return false
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return item.itemName.toLowerCase().includes(q) || item.location.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
  })

  const getStatusText = (item) => {
    if (item.isResolved) return { text: 'Returned', cls: 'text-emerald-600 dark:text-emerald-400' }
    if (item.foundReported) return { text: 'Finder Responded', cls: 'text-[var(--cm-text)]' }
    return item.type === 'lost'
      ? { text: 'Lost', cls: 'text-rose-600 dark:text-rose-400' }
      : { text: 'Found', cls: 'text-emerald-600 dark:text-emerald-400' }
  }

  return (
    <div className="min-h-full bg-[var(--cm-bg)] text-[var(--cm-text)]">
      {/* Marketplace Top Header */}
      <header className="border-b border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <span className="font-['Poppins'] text-xl font-bold tracking-tight text-[var(--cm-text)]">
            CampusFind
          </span>

          <div className="order-3 w-full sm:order-2 sm:flex-1 sm:max-w-xl">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phones, ID cards, books, water bottles..."
                className="w-full rounded border border-[var(--cm-border)] bg-[var(--cm-bg)] py-2 pl-9 pr-3 text-sm text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-muted)] focus:outline-none"
              />
            </div>
          </div>

          <div className="order-2 flex items-center gap-2.5 sm:order-3">
            <button
              onClick={() => setShowActivity((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--cm-border)] bg-[var(--cm-card)] px-2.5 py-2 text-xs font-medium text-[var(--cm-text)] hover:bg-[var(--cm-secondary)]"
            >
              <Bell size={14} /> {notifications.length}
            </button>
            <button
              onClick={() => { setFormData(INITIAL_FORM); setIsFormOpen(true) }}
              className="inline-flex items-center gap-1.5 rounded bg-[var(--cm-accent)] px-4 py-2 text-xs font-semibold text-[var(--cm-accent-text)] hover:opacity-90"
            >
              <Plus size={14} /> Post an Item
            </button>
            <Link to="/profile" className="hidden items-center gap-2 border-l border-[var(--cm-border)] pl-3 text-xs font-medium text-[var(--cm-muted)] hover:text-[var(--cm-text)] lg:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded border border-[var(--cm-border)] bg-[var(--cm-secondary)] font-semibold text-[var(--cm-text)]">
                {MOCK_USER.avatarInitials}
              </span>
              <span>{MOCK_USER.name}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Horizontal Navigation Strip */}
      <div className="border-b border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <nav className="flex gap-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition ${
                  activeTab === tab
                    ? 'border-[var(--cm-text)] text-[var(--cm-text)]'
                    : 'border-transparent text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                }`}
              >
                {tab}{tab === 'Saved' ? ` (${bookmarkedIds.length})` : ''}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded border border-[var(--cm-border)] px-2.5 py-1 text-xs font-medium text-[var(--cm-text)] md:hidden"
          >
            <SlidersHorizontal size={13} /> Filters
          </button>
        </div>
      </div>

      {/* Main Two-Column Marketplace Workspace */}
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row">
        {/* Left-Side Filter Panel */}
        <aside className={`${mobileFiltersOpen ? 'block' : 'hidden'} w-full shrink-0 space-y-5 md:block md:w-56`}>
          <FilterGroup title="Categories" options={CATEGORIES} value={category} onChange={setCategory} />
          <FilterGroup title="Campus Locations" options={LOCATIONS} value={locationTag} onChange={setLocationTag} />
          <FilterGroup title="Status" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          {(category !== 'All' || locationTag !== 'All' || statusFilter !== 'All') && (
            <button
              onClick={() => { setCategory('All'); setLocationTag('All'); setStatusFilter('All') }}
              className="text-xs font-medium text-[var(--cm-text)] underline"
            >
              Reset all filters
            </button>
          )}
        </aside>

        {/* Listings Area */}
        <main className="min-w-0 flex-1 space-y-4">
          {showActivity && (
            <div className="rounded border border-[var(--cm-border)] bg-[var(--cm-card)] p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[var(--cm-text)]">
                <span>Activity Updates</span>
                <button onClick={() => setShowActivity(false)} className="text-[var(--cm-muted)] hover:underline">Close</button>
              </div>
              <ul className="space-y-1 text-xs text-[var(--cm-muted)]">
                {notifications.slice(0, 4).map((n) => (
                  <li key={n.id} className="flex justify-between gap-3">
                    <span className="text-[var(--cm-text)]">{n.text}</span>
                    <span className="shrink-0">{n.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-[var(--cm-muted)]">
            <span>Showing {filteredItems.length} {filteredItems.length === 1 ? 'listing' : 'listings'}</span>
            <span>{locationTag !== 'All' ? `Area: ${locationTag}` : 'All Campus Areas'}</span>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No listings match your filters"
              description="Try changing your search, category, or campus location filter."
              action={{ label: 'Post an Item', onClick: () => setIsFormOpen(true) }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => {
                const st = getStatusText(item)
                const isSaved = bookmarkedIds.includes(item.id)
                return (
                  <article
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="group cursor-pointer rounded-md border border-[var(--cm-border)] bg-[var(--cm-card)] p-2.5 transition hover:border-[var(--cm-muted)]"
                  >
                    <div className="overflow-hidden rounded border border-[var(--cm-border)] bg-[var(--cm-secondary)]">
                      <img
                        src={item.imageUrl || ITEM_CATEGORY_IMAGES[item.category] || ITEM_CATEGORY_IMAGES.Other}
                        alt={item.itemName}
                        className="h-48 w-full object-cover"
                      />
                    </div>

                    <div className="pt-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-semibold uppercase tracking-wide ${st.cls}`}>
                          {st.text} · {item.category || 'Other'}
                        </span>
                        <button
                          onClick={(e) => toggleBookmark(item.id, e)}
                          aria-label="Save listing"
                          className="text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
                        >
                          <Bookmark size={15} className={isSaved ? 'fill-current text-[var(--cm-text)]' : ''} />
                        </button>
                      </div>
                      <h3 className="mt-0.5 line-clamp-1 text-[15px] font-semibold text-[var(--cm-text)]">
                        {item.itemName}
                      </h3>
                      <p className="truncate text-xs text-[var(--cm-muted)]">{item.location}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--cm-muted)]">{formatDate(item.dateOccurred)}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Detailed Listing Modal */}
      {selectedItem && (
        <Modal isOpen={true} onClose={() => setSelectedItem(null)} title={selectedItem.itemName} size="lg">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <img
              src={selectedItem.imageUrl || ITEM_CATEGORY_IMAGES[selectedItem.category] || ITEM_CATEGORY_IMAGES.Other}
              alt={selectedItem.itemName}
              className="h-64 w-full rounded border border-[var(--cm-border)] object-cover"
            />
            <div className="flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase ${getStatusText(selectedItem).cls}`}>
                    {getStatusText(selectedItem).text} · {selectedItem.category || 'Other'}
                  </span>
                  <button
                    onClick={() => toggleBookmark(selectedItem.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
                  >
                    <Bookmark size={14} className={bookmarkedIds.includes(selectedItem.id) ? 'fill-current text-[var(--cm-text)]' : ''} />
                    {bookmarkedIds.includes(selectedItem.id) ? 'Saved' : 'Save'}
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-[var(--cm-text)]">{selectedItem.description}</p>
                <div className="space-y-1 border-t border-[var(--cm-border)] pt-3 text-xs text-[var(--cm-muted)]">
                  <p><strong className="text-[var(--cm-text)]">Campus Area:</strong> {selectedItem.locationTag || 'Campus'}</p>
                  <p><strong className="text-[var(--cm-text)]">Location:</strong> {selectedItem.location}</p>
                  <p><strong className="text-[var(--cm-text)]">Date:</strong> {formatDate(selectedItem.dateOccurred)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {selectedItem.type === 'lost' && !selectedItem.isResolved && !selectedItem.foundReported && (
                  <button onClick={() => handleFoundResponse(selectedItem)} className="flex-1 rounded bg-[var(--cm-accent)] px-3 py-2 text-xs font-semibold text-[var(--cm-accent-text)] hover:opacity-90">
                    I Found This Item
                  </button>
                )}
                {selectedItem.userId === MOCK_USER.id && !selectedItem.isResolved && (
                  <button onClick={() => handleMarkReturned(selectedItem)} className="flex-1 rounded border border-[var(--cm-border)] bg-[var(--cm-secondary)] px-3 py-2 text-xs font-semibold text-[var(--cm-text)] hover:opacity-90">
                    Mark as Returned
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Post an Item Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Post an Item" size="sm">
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            {['lost', 'found'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, type: t }))}
                className={`rounded border py-2 text-xs font-semibold capitalize ${
                  formData.type === t
                    ? 'border-[var(--cm-text)] bg-[var(--cm-secondary)] text-[var(--cm-text)]'
                    : 'border-[var(--cm-border)] text-[var(--cm-muted)]'
                }`}
              >
                {t} Item
              </button>
            ))}
          </div>
          <div>
            <label className={labelCls}>Item Photo</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-[var(--cm-border)] py-2.5 text-xs text-[var(--cm-muted)] hover:text-[var(--cm-text)]">
              <Upload size={14} /> Upload Photo
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
            {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="mt-2 h-32 w-full rounded border border-[var(--cm-border)] object-cover" />}
          </div>
          <div>
            <label className={labelCls}>Item Name *</label>
            <input type="text" required placeholder="e.g. Black Casio Calculator" value={formData.itemName} onChange={(e) => setFormData({ ...formData, itemName: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={inputCls}>
                {CATEGORIES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Campus Area</label>
              <select value={formData.locationTag} onChange={(e) => setFormData({ ...formData, locationTag: e.target.value })} className={inputCls}>
                {LOCATIONS.slice(1).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Specific Location *</label>
              <input type="text" required placeholder="e.g. Library 2nd Floor" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={formData.dateOccurred} onChange={(e) => setFormData({ ...formData, dateOccurred: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={2} placeholder="Color, brand, or unique marks..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsFormOpen(false)} className="rounded border border-[var(--cm-border)] px-4 py-2 text-xs font-medium text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]">Cancel</button>
            <button type="submit" className="rounded bg-[var(--cm-accent)] px-4 py-2 text-xs font-semibold text-[var(--cm-accent-text)] hover:opacity-90">Publish Listing</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default LostFound
