// src/pages/Resources.jsx — NoteNest Notes and Study Resources module
// Search, organize and share study materials, lecture notes and external tutorials by semester and subject.

import { useState, useMemo } from 'react'
import {
  BookOpen, Plus, Search, ExternalLink
} from 'lucide-react'
import Badge, { resourceTypeBadge } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_RESOURCES } from '../utils/mockData'

const SEMESTERS = ['all', 1, 2, 3, 4, 5, 6, 7, 8]
const TYPES = [
  { id: 'all', label: 'All Types' },
  { id: 'pdf', label: 'PDF Notes' },
  { id: 'link', label: 'Web Links' },
  { id: 'video', label: 'Videos' },
  { id: 'note', label: 'Notes' },
]

function Resources() {
  const [resources, setResources] = useState(MOCK_RESOURCES)
  const [selectedSemester, setSelectedSemester] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    semester: 5,
    resourceType: 'link',
    url: '',
    tags: '',
  })
  const [formError, setFormError] = useState('')

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources
      .filter((res) => {
        if (selectedSemester !== 'all' && res.semester !== Number(selectedSemester)) return false
        if (selectedType !== 'all' && res.resourceType !== selectedType) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchTitle = res.title.toLowerCase().includes(q)
          const matchSubject = res.subject.toLowerCase().includes(q)
          const matchDesc = res.description?.toLowerCase().includes(q)
          const matchTag = res.tags?.some(t => t.toLowerCase().includes(q))
          if (!matchTitle && !matchSubject && !matchDesc && !matchTag) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [resources, selectedSemester, selectedType, searchQuery])

  // Handlers
  const handleOpenAdd = () => {
    setFormData({
      title: '',
      description: '',
      subject: '',
      semester: 5,
      resourceType: 'link',
      url: '',
      tags: '',
    })
    setFormError('')
    setIsAddOpen(true)
  }

  const handleAddSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setFormError('Title is required.')
      return
    }
    if (!formData.subject.trim()) {
      setFormError('Subject is required.')
      return
    }
    if (!formData.url.trim()) {
      setFormError('Resource link or URL is required.')
      return
    }

    const tagArray = formData.tags
      ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

    const newRes = {
      id: `res-${Date.now()}`,
      title: formData.title.trim(),
      description: formData.description.trim(),
      subject: formData.subject.trim(),
      semester: Number(formData.semester),
      resourceType: formData.resourceType,
      url: formData.url.trim(),
      tags: tagArray,
      createdAt: new Date().toISOString(),
    }

    setResources(prev => [newRes, ...prev])
    setIsAddOpen(false)
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
            NoteNest
          </h1>
          <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] mt-1">
            Access and contribute verified syllabus notes, study drives, lecture slides and tutorials.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#A9C9FF] text-white rounded-xl font-medium text-sm hover:bg-[#8BB8F8] transition-colors shadow-sm"
        >
          <Plus size={16} />
          Add Resource
        </button>
      </div>

      {/* ══ FILTERS & SEARCH BAR ═════════════════════════════════ */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737B8C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, textbooks, topics, or tags..."
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#252A3C] border border-[#E2E8F0] dark:border-white/[0.07] rounded-2xl text-sm text-[#242B3A] dark:text-[#F1F1FC] placeholder-[#737B8C] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50 shadow-sm"
          />
        </div>

        {/* Semester pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-[#737B8C] dark:text-[#A0A8B8] uppercase tracking-wider mr-1">
            Semester:
          </span>
          {SEMESTERS.map(sem => (
            <button
              key={sem}
              onClick={() => setSelectedSemester(sem)}
              className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedSemester === sem
                  ? 'bg-[#C8B6FF] text-white shadow-sm'
                  : 'bg-white dark:bg-[#252A3C] text-[#737B8C] dark:text-[#A0A8B8] border border-[#E2E8F0] dark:border-white/[0.07] hover:text-[#242B3A] dark:hover:text-[#F1F1FC]'
              }`}
            >
              {sem === 'all' ? 'All Semesters' : `Sem ${sem}`}
            </button>
          ))}
        </div>

        {/* Type pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-[#737B8C] dark:text-[#A0A8B8] uppercase tracking-wider mr-1">
            Format:
          </span>
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedType === t.id
                  ? 'bg-[#A9C9FF] text-white shadow-sm'
                  : 'bg-white dark:bg-[#252A3C] text-[#737B8C] dark:text-[#A0A8B8] border border-[#E2E8F0] dark:border-white/[0.07] hover:text-[#242B3A] dark:hover:text-[#F1F1FC]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ RESOURCES GRID ═══════════════════════════════════════ */}
      {filteredResources.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No resources found"
          description="Try selecting a different semester or clearing your search."
          action={{ label: 'Share a Resource', onClick: handleOpenAdd }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map(res => {
            const tBadge = resourceTypeBadge(res.resourceType)

            return (
              <div
                key={res.id}
                className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Badge variant={tBadge.variant}>{tBadge.label}</Badge>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#F0EBFF] dark:bg-[#C8B6FF]/10 text-[#9B7FE8] dark:text-[#C8B6FF] font-medium">
                      Sem {res.semester}
                    </span>
                  </div>

                  <h3
                    className="font-semibold text-base text-[#242B3A] dark:text-[#F1F1FC] mb-1.5"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {res.title}
                  </h3>

                  <p className="text-xs font-medium text-[#5B9BF8] mb-2">
                    {res.subject}
                  </p>

                  <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] line-clamp-3 mb-4 leading-relaxed">
                    {res.description}
                  </p>

                  {/* Tags */}
                  {res.tags && res.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {res.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-[#F7F8FC] dark:bg-white/5 text-[#737B8C] dark:text-[#A0A8B8]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Open link button */}
                <div className="pt-3 border-t border-[#E2E8F0] dark:border-white/[0.05]">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-[#EAF2FF] dark:bg-[#A9C9FF]/10 text-[#5B9BF8] dark:text-[#A9C9FF] rounded-xl text-xs font-medium hover:bg-[#A9C9FF] hover:text-white dark:hover:bg-[#A9C9FF] dark:hover:text-white transition-colors"
                  >
                    Open Resource <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ ADD RESOURCE MODAL ═══════════════════════════════════ */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Share Study Material"
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
              Resource Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Operating Systems Handwritten Notes"
              required
              className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Subject *
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData(f => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Operating Systems"
                required
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Semester
              </label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData(f => ({ ...f, semester: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-xs text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Resource Type
              </label>
              <select
                value={formData.resourceType}
                onChange={(e) => setFormData(f => ({ ...f, resourceType: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-xs text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              >
                <option value="pdf">PDF Document</option>
                <option value="link">Web Link</option>
                <option value="video">Video Tutorial</option>
                <option value="note">Short Note</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                URL / Drive Link *
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(f => ({ ...f, url: e.target.value }))}
                placeholder="https://drive.google.com/..."
                required
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(f => ({ ...f, tags: e.target.value }))}
              placeholder="e.g. OS, threads, scheduling, exam prep"
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
              placeholder="What does this resource cover? Any tips for studying?"
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
              Save Resource
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Resources
