// src/pages/LostFound.jsx — Marketplace-style CampusFind Lost & Found module with rich photography

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Plus,
  Search,
  Bookmark,
  Bell,
  Upload,
  MapPin,
  Compass,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_LOST_FOUND, MOCK_USER, ITEM_CATEGORY_IMAGES } from '../utils/mockData'

const TABS = ['All', 'Lost', 'Found', 'Saved', 'Resolved']
const CATEGORIES = ['All', 'Electronics', 'Accessories', 'Documents', 'Books', 'Other']
const LOCATIONS = ['All', 'Library', 'Canteen', 'Hostel', 'Labs', 'Auditorium']
const INITIAL_FORM = {
  type: 'lost',
  itemName: '',
  description: '',
  category: 'Electronics',
  locationTag: 'Library',
  location: '',
  dateOccurred: '',
  imageUrl: '',
}

const inputCls =
  'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-sm text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-accent)] focus:outline-none transition'
const labelCls = 'mb-1 block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider'

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function LostFound({ items = MOCK_LOST_FOUND, onAddItem, onUpdateItem }) {
  const { state } = useLocation()
  const [activeTab, setActiveTab] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedLocation, setSelectedLocation] = useState('All')
  const [bookmarkedIds, setBookmarkedIds] = useState(['lf-1'])
  const [showActivity, setShowActivity] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 'n-1', text: 'Listing "OnePlus Nord (Black)" is active in Central Library.', time: '10m ago' },
    { id: 'n-2', text: 'Someone responded regarding "Physics Notebook — Sem 5".', time: '1h ago' },
  ])
  const [selectedItem, setSelectedItem] = useState(() =>
    items.find((i) => i.id === state?.selectedId) || null
  )
  const [isFormOpen, setIsFormOpen] = useState(Boolean(state?.openAdd))
  const [formData, setFormData] = useState(INITIAL_FORM)

  const addNotification = (text) =>
    setNotifications((prev) => [{ id: `n-${Date.now()}`, text, time: 'Just now' }, ...prev])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, imageUrl: URL.createObjectURL(file) }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.itemName.trim() || !formData.location.trim()) return

    const newItem = {
      id: `lf-${Date.now()}`,
      type: formData.type,
      itemName: formData.itemName.trim(),
      description: formData.description.trim() || 'Reported on CampusFind marketplace.',
      category: formData.category,
      locationTag: formData.locationTag,
      location: formData.location.trim(),
      dateOccurred: formData.dateOccurred
        ? new Date(formData.dateOccurred).toISOString()
        : new Date().toISOString(),
      imageUrl:
        formData.imageUrl ||
        ITEM_CATEGORY_IMAGES[formData.category] ||
        ITEM_CATEGORY_IMAGES.Other,
      isResolved: false,
      userId: MOCK_USER.id,
      createdAt: new Date().toISOString(),
    }

    onAddItem?.(newItem)
    addNotification(`Posted ${newItem.type} item "${newItem.itemName}" in ${newItem.locationTag}.`)
    setFormData(INITIAL_FORM)
    setIsFormOpen(false)
  }

  const toggleBookmark = (id, e) => {
    e?.stopPropagation()
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleFoundAction = (item) => {
    addNotification(`You notified the student who posted "${item.itemName}"!`)
    alert(`Thank you! A response has been delivered to the student who reported "${item.itemName}".`)
  }

  const handleMarkReturned = (item) => {
    onUpdateItem?.(item.id, { isResolved: true })
    if (selectedItem?.id === item.id) {
      setSelectedItem((prev) => ({ ...prev, isResolved: true }))
    }
    addNotification(`Item "${item.itemName}" was marked as returned.`)
  }

  const filteredItems = items.filter((item) => {
    if (activeTab === 'Lost' && item.type !== 'lost') return false
    if (activeTab === 'Found' && item.type !== 'found') return false
    if (activeTab === 'Saved' && !bookmarkedIds.includes(item.id)) return false
    if (activeTab === 'Resolved' && !item.isResolved) return false
    if (activeTab !== 'Resolved' && activeTab !== 'Saved' && item.isResolved && activeTab !== 'All')
      return false

    if (selectedCategory !== 'All' && item.category !== selectedCategory) return false
    if (selectedLocation !== 'All' && item.locationTag !== selectedLocation) return false

    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      item.itemName.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. CAMPUSFIND MARKETPLACE HERO ── */}
      <div className="workspace-page-header border-b border-[var(--cm-border)] bg-[var(--cm-surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <div className="workspace-page-kicker"><span /> CAMPUSFIND / DEMO DATA</div>
              <h1 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--cm-text)]">
                Good things find their way back.
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-[var(--cm-muted)] leading-relaxed">
                Misplaced your headphones, bottle, or student ID card? Search community listings or report a found item to return it to fellow students.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-end">
              <button
                onClick={() => setShowActivity(!showActivity)}
                className="relative inline-flex items-center gap-2 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-4 py-2.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
              >
                <Bell size={14} className="text-[var(--cm-accent)]" /> Activity ({notifications.length})
                {notifications.length > 0 && (
                  <span className="h-2 w-2 rounded-full bg-[var(--cm-accent)]" />
                )}
              </button>
              <button
                onClick={() => setIsFormOpen(true)}
                className="workspace-primary-button"
              >
                <Plus size={16} /> Post an Item
              </button>
            </div>
          </div>

          {/* Activity dropdown banner */}
          {showActivity && (
            <div className="mt-6 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-5">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--cm-border)]">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--cm-text)]">
                  Live CampusFind Recovery Activity
                </span>
                <button
                  onClick={() => setShowActivity(false)}
                  className="text-xs text-[var(--cm-muted)] hover:underline cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="divide-y divide-[var(--cm-border)]/50 pt-1">
                {notifications.map((n) => (
                  <div key={n.id} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="text-[var(--cm-text)] font-medium">{n.text}</span>
                    <span className="text-[10px] text-[var(--cm-muted)] font-mono">{n.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* ── 2. TABS + SEARCH BAR ── */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          {/* Horizontal Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-1 text-xs shadow-2xs">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
                    : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                }`}
              >
                {tab}
                {tab === 'Saved' && ` (${bookmarkedIds.length})`}
              </button>
            ))}
          </div>

          {/* Wide Search Bar */}
          <div className="relative w-full lg:w-96">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items, brands, canteen, library..."
              className="w-full rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] py-2.5 pr-4 pl-10 text-xs text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-accent)] focus:outline-none transition shadow-2xs"
            />
          </div>
        </div>

        {/* ── 3. FILTER CHIPS (Categories & Campus Locations) ── */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5 shadow-xs">
          {/* Categories */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)] w-24">
              Category:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-xl px-3.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[var(--cm-secondary)] font-bold text-[var(--cm-text)] border border-[var(--cm-border)] shadow-xs'
                      : 'text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]/60'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Campus Locations */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--cm-border)]/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)] w-24">
              Campus Area:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setSelectedLocation(loc)}
                  className={`rounded-xl px-3.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    selectedLocation === loc
                      ? 'bg-[var(--cm-secondary)] font-bold text-[var(--cm-text)] border border-[var(--cm-border)] shadow-xs'
                      : 'text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]/60'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 4. LARGE PHOTO LISTINGS GRID ── */}
        {filteredItems.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="No items found"
            description="No items match your selected filters. Try choosing 'All' or posting a report."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredItems.map((item) => {
              const isSaved = bookmarkedIds.includes(item.id)
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${item.itemName}`}
                  onClick={() => setSelectedItem(item)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      setSelectedItem(item)
                    }
                  }}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-xs hover:border-[var(--cm-accent)]/80 hover:shadow-md transition-all duration-300 cursor-pointer"
                >
                  {/* Photo area */}
                  <div className="relative h-48 w-full overflow-hidden bg-[var(--cm-secondary)]">
                    <img
                      src={item.imageUrl}
                      alt={item.itemName}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />

                    {/* Status badge */}
                    <div className="absolute top-3 left-3">
                      <span
                        className={`rounded-lg px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-sm text-white ${
                          item.isResolved
                            ? 'bg-slate-700'
                            : item.type === 'lost'
                            ? 'bg-[#713c49]'
                            : 'bg-emerald-600'
                        }`}
                      >
                        {item.isResolved ? 'Resolved' : item.type}
                      </span>
                    </div>

                    {/* Bookmark button */}
                    <button
                      onClick={(e) => toggleBookmark(item.id, e)}
                      className="absolute top-3 right-3 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 shadow-md backdrop-blur-xs transition"
                      aria-label={isSaved ? 'Remove saved listing' : 'Save listing'}
                      aria-pressed={isSaved}
                    >
                      <Bookmark
                        size={15}
                        className={isSaved ? 'fill-[#dce4b2] text-[#dce4b2]' : ''}
                      />
                    </button>

                    {/* Campus Location Tag */}
                    <div className="absolute bottom-3 left-3">
                      <span className="rounded-lg bg-black/60 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                        📍 {item.locationTag || 'Campus'}
                      </span>
                    </div>
                  </div>

                  {/* Info area */}
                  <div className="flex flex-1 flex-col justify-between p-4.5 space-y-2">
                    <div>
                      <h3 className="font-['Poppins'] text-sm font-bold text-[var(--cm-text)] line-clamp-1 group-hover:text-[var(--cm-accent)] transition">
                        {item.itemName}
                      </h3>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[var(--cm-muted)] line-clamp-1">
                        <MapPin size={12} className="shrink-0 text-[var(--cm-accent)]" />
                        {item.location}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-[var(--cm-border)]/60 flex items-center justify-between text-[11px] text-[var(--cm-muted)]">
                      <span>{formatDate(item.dateOccurred)}</span>
                      <span className="font-bold text-[var(--cm-accent)] group-hover:underline">
                        Details →
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── ITEM DETAILS MODAL ── */}
      {selectedItem && (
        <Modal
          isOpen={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
          title={selectedItem.itemName}
        >
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-secondary)]">
              <img
                src={selectedItem.imageUrl}
                alt={selectedItem.itemName}
                className="h-60 w-full object-cover"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-lg px-3 py-1 text-xs font-bold uppercase text-white ${
                  selectedItem.isResolved
                    ? 'bg-slate-700'
                    : selectedItem.type === 'lost'
                    ? 'bg-[#713c49]'
                    : 'bg-emerald-600'
                }`}
              >
                {selectedItem.isResolved ? 'Resolved / Returned' : selectedItem.type.toUpperCase()}
              </span>
              <span className="rounded-lg bg-[var(--cm-secondary)] px-3 py-1 text-xs font-semibold text-[var(--cm-text)]">
                {selectedItem.category}
              </span>
              <span className="rounded-lg bg-[var(--cm-secondary)] px-3 py-1 text-xs font-semibold text-[var(--cm-text)]">
                {selectedItem.locationTag}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Item Description</span>
              <p className="text-xs text-[var(--cm-text)] leading-relaxed">
                {selectedItem.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3">
                <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Specific Location</span>
                <p className="mt-1 font-bold text-[var(--cm-text)]">{selectedItem.location}</p>
              </div>
              <div className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3">
                <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Date Reported</span>
                <p className="mt-1 font-bold text-[var(--cm-text)]">{formatDate(selectedItem.dateOccurred)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2.5 pt-3 border-t border-[var(--cm-border)]">
              {selectedItem.type === 'lost' && !selectedItem.isResolved && (
                <button
                  type="button"
                  onClick={() => handleFoundAction(selectedItem)}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                >
                  I Found This Item 🤝
                </button>
              )}

              {!selectedItem.isResolved ? (
                <button
                  type="button"
                  onClick={() => handleMarkReturned(selectedItem)}
                  className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-2.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
                >
                  Mark as Returned ✓
                </button>
              ) : (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold py-2">
                  ✓ This item has been safely returned to its student owner.
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── REPORT / POST AN ITEM MODAL ── */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Report a Lost or Found Item">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Listing Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className={inputCls}
              >
                <option value="lost">Lost Item (I misplaced something)</option>
                <option value="found">Found Item (I discovered an item)</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Item Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Blue Tupperware Bottle"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={inputCls}
              >
                {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Campus Area Tag</label>
              <select
                value={formData.locationTag}
                onChange={(e) => setFormData({ ...formData, locationTag: e.target.value })}
                className={inputCls}
              >
                {LOCATIONS.filter((l) => l !== 'All').map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Specific Location</label>
              <input
                type="text"
                required
                placeholder="e.g. Library 2nd floor study table"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Date & Time</label>
              <input
                type="date"
                value={formData.dateOccurred}
                onChange={(e) => setFormData({ ...formData, dateOccurred: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* Photo upload + preview */}
          <div>
            <label className={labelCls}>Item Photograph</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-4 py-2.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] cursor-pointer transition">
                <Upload size={14} className="text-[var(--cm-accent)]" /> Upload Photograph
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              {formData.imageUrl && (
                <div className="h-12 w-12 rounded-xl border border-[var(--cm-border)] overflow-hidden">
                  <img src={formData.imageUrl} alt="Preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Description & Identifying Marks</label>
            <textarea
              rows={3}
              placeholder="Color, brand, stickers, unique scratches, or contact instructions..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--cm-border)]">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-xl border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="workspace-primary-button"
            >
              Post to Marketplace
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default LostFound
