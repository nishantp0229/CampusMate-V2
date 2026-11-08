// src/pages/LostFound.jsx — CampusFind Lost and Found module
// Post lost/found items, view details, search by location and contact finders.

import { useState, useMemo } from 'react'
import {
  MapPin, Plus, Search, Calendar,
  CheckCircle2, User
} from 'lucide-react'
import Badge, { typeBadge } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_LOST_FOUND } from '../utils/mockData'

function LostFound() {
  const [items, setItems] = useState(MOCK_LOST_FOUND)
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'lost' | 'found'
  const [showResolved, setShowResolved] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [selectedItem, setSelectedItem] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const [formData, setFormData] = useState({
    type: 'lost',
    itemName: '',
    description: '',
    location: '',
    dateOccurred: new Date().toISOString().split('T')[0],
    contactName: '',
    contactInfo: '',
  })
  const [formError, setFormError] = useState('')

  // Filtered items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (typeFilter !== 'all' && item.type !== typeFilter) return false
        if (!showResolved && item.isResolved) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchName = item.itemName.toLowerCase().includes(q)
          const matchLoc = item.location.toLowerCase().includes(q)
          const matchDesc = item.description?.toLowerCase().includes(q)
          if (!matchName && !matchLoc && !matchDesc) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.dateOccurred) - new Date(a.dateOccurred))
  }, [items, typeFilter, showResolved, searchQuery])

  // Handlers
  const handleToggleResolved = (id) => {
    setItems(prev =>
      prev.map(it =>
        it.id === id ? { ...it, isResolved: !it.isResolved } : it
      )
    )
    if (selectedItem && selectedItem.id === id) {
      setSelectedItem(prev => ({ ...prev, isResolved: !prev.isResolved }))
    }
  }

  const handleOpenDetail = (it) => {
    setSelectedItem(it)
    setIsDetailOpen(true)
  }

  const handleOpenCreate = (type = 'lost') => {
    setFormData({
      type,
      itemName: '',
      description: '',
      location: '',
      dateOccurred: new Date().toISOString().split('T')[0],
      contactName: '',
      contactInfo: '',
    })
    setFormError('')
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (!formData.itemName.trim()) {
      setFormError('Item name is required.')
      return
    }
    if (!formData.location.trim()) {
      setFormError('Location is required.')
      return
    }
    if (!formData.contactInfo.trim()) {
      setFormError('Contact information is required.')
      return
    }

    const newItem = {
      id: `lf-${Date.now()}`,
      type: formData.type,
      itemName: formData.itemName.trim(),
      description: formData.description.trim(),
      location: formData.location.trim(),
      dateOccurred: new Date(formData.dateOccurred).toISOString(),
      contactName: formData.contactName.trim() || 'Anonymous',
      contactInfo: formData.contactInfo.trim(),
      isResolved: false,
      userId: 'user-1',
      createdAt: new Date().toISOString(),
    }

    setItems(prev => [newItem, ...prev])
    setIsCreateOpen(false)
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
            CampusFind
          </h1>
          <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] mt-1">
            Lost something on campus or found an item? Help fellow students recover their belongings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenCreate('lost')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl font-medium text-xs hover:bg-red-100 transition-colors"
          >
            <Plus size={14} />
            Report Lost
          </button>
          <button
            onClick={() => handleOpenCreate('found')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#A9C9FF] text-white rounded-xl font-medium text-xs hover:bg-[#8BB8F8] transition-colors shadow-sm"
          >
            <Plus size={14} />
            Report Found
          </button>
        </div>
      </div>

      {/* ══ FILTERS & SEARCH BAR ═════════════════════════════════ */}
      <div className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-3.5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737B8C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by item name, place, or keyword..."
            className="w-full pl-9 pr-3 py-2 bg-[#F7F8FC] dark:bg-[#171A29] border border-transparent rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] placeholder-[#737B8C] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Type filter tabs */}
          <div className="flex items-center gap-1 bg-[#F7F8FC] dark:bg-[#171A29] p-1 rounded-xl">
            {[
              { id: 'all', label: 'All' },
              { id: 'lost', label: 'Lost' },
              { id: 'found', label: 'Found' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  typeFilter === tab.id
                    ? 'bg-white dark:bg-[#252A3C] text-[#242B3A] dark:text-[#F1F1FC] shadow-sm'
                    : 'text-[#737B8C] dark:text-[#A0A8B8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Include resolved checkbox */}
          <label className="flex items-center gap-2 text-xs text-[#737B8C] dark:text-[#A0A8B8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded text-[#A9C9FF] focus:ring-[#A9C9FF]"
            />
            Show resolved
          </label>
        </div>
      </div>

      {/* ══ ITEMS GRID ═══════════════════════════════════════════ */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No items found"
          description="No lost or found posts match your criteria."
          action={{ label: 'Report an Item', onClick: () => handleOpenCreate('lost') }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map(item => {
            const tBadge = typeBadge(item.type)

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  item.isResolved ? 'opacity-60' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Badge variant={tBadge.variant}>{tBadge.label}</Badge>
                    {item.isResolved ? (
                      <span className="text-[11px] font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Resolved
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#737B8C] dark:text-[#A0A8B8]">
                        Active
                      </span>
                    )}
                  </div>

                  <h3
                    className="font-semibold text-base text-[#242B3A] dark:text-[#F1F1FC] mb-2"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {item.itemName}
                  </h3>

                  <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] line-clamp-2 mb-4 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="space-y-1.5 text-xs text-[#737B8C] dark:text-[#A0A8B8] mb-5">
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-[#FF9BAA]" />
                      <span className="truncate">{item.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-[#5B9BF8]" />
                      <span>{formatDate(item.dateOccurred)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <div className="pt-3 border-t border-[#E2E8F0] dark:border-white/[0.05] flex items-center justify-between">
                  <span className="text-[11px] text-[#737B8C] dark:text-[#A0A8B8] truncate max-w-[150px]">
                    By: {item.contactName}
                  </span>

                  <button
                    onClick={() => handleOpenDetail(item)}
                    className="text-xs font-medium text-[#5B9BF8] hover:underline"
                  >
                    View & Contact
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ DETAIL MODAL ═════════════════════════════════════════ */}
      {selectedItem && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={selectedItem.itemName}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={typeBadge(selectedItem.type).variant}>
                {typeBadge(selectedItem.type).label}
              </Badge>
              <button
                onClick={() => handleToggleResolved(selectedItem.id)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedItem.isResolved
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                    : 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                }`}
              >
                {selectedItem.isResolved ? 'Mark as Unresolved' : 'Mark as Claimed / Resolved'}
              </button>
            </div>

            <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] leading-relaxed">
              {selectedItem.description}
            </p>

            <div className="p-3.5 rounded-xl bg-[#F7F8FC] dark:bg-[#171A29] space-y-2 text-xs text-[#242B3A] dark:text-[#F1F1FC]">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-[#FF9BAA]" />
                <span><strong>Location:</strong> {selectedItem.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[#5B9BF8]" />
                <span><strong>Date:</strong> {formatDate(selectedItem.dateOccurred)}</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={14} className="text-[#6BCB9A]" />
                <span><strong>Posted by:</strong> {selectedItem.contactName}</span>
              </div>
            </div>

            {/* Contact details callout */}
            <div className="p-3.5 rounded-xl border border-[#A9C9FF]/40 bg-[#EAF2FF]/50 dark:bg-[#A9C9FF]/5 space-y-1">
              <p className="text-xs font-semibold text-[#242B3A] dark:text-[#F1F1FC]">
                Contact to claim or report:
              </p>
              <p className="text-sm font-mono text-[#5B9BF8] select-all">
                {selectedItem.contactInfo}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ REPORT FORM MODAL ════════════════════════════════════ */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={formData.type === 'lost' ? 'Report Lost Item' : 'Report Found Item'}
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-3.5">
          {formError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Post Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData(f => ({ ...f, type: 'lost' }))}
                className={`py-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                  formData.type === 'lost'
                    ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                    : 'border-[#E2E8F0] dark:border-white/[0.07] text-[#737B8C]'
                }`}
              >
                I Lost Something
              </button>
              <button
                type="button"
                onClick={() => setFormData(f => ({ ...f, type: 'found' }))}
                className={`py-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                  formData.type === 'found'
                    ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                    : 'border-[#E2E8F0] dark:border-white/[0.07] text-[#737B8C]'
                }`}
              >
                I Found Something
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Item Name *
            </label>
            <input
              type="text"
              value={formData.itemName}
              onChange={(e) => setFormData(f => ({ ...f, itemName: e.target.value }))}
              placeholder="e.g. Blue Casio Calculator fx-991EX"
              required
              className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Location *
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Library 2nd Floor"
                required
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={formData.dateOccurred}
                onChange={(e) => setFormData(f => ({ ...f, dateOccurred: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData(f => ({ ...f, contactName: e.target.value }))}
                placeholder="e.g. Arjun Mehta"
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Contact Info (Phone/Email) *
              </label>
              <input
                type="text"
                value={formData.contactInfo}
                onChange={(e) => setFormData(f => ({ ...f, contactInfo: e.target.value }))}
                placeholder="e.g. 9876543210 or email"
                required
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Description / Distinguishing Features
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="Color, brand, stickers, unique scratches, contents..."
              className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.1] text-xs font-medium text-[#737B8C]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#A9C9FF] text-white rounded-xl text-xs font-medium hover:bg-[#8BB8F8] transition-colors"
            >
              Post Item
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default LostFound
