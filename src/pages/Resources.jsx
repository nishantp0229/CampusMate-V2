// src/pages/Resources.jsx — NoteNest academic vault & resource library inspired by Campus Compass

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  FileText,
  Video,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_RESOURCES } from '../utils/mockData'

const SEMESTERS = ['All', '1', '2', '3', '4', '5', '6', '7', '8']

const FORMAT_TABS = [
  { id: 'all', label: 'All Formats' },
  { id: 'pdf', label: 'PDF Notes' },
  { id: 'link', label: 'Web Docs & Links' },
  { id: 'video', label: 'Video Tutorials' },
  { id: 'note', label: 'Handwritten Notes' },
]

const SUBJECT_SHORTCUTS = [
  'All Subjects',
  'Database Management Systems',
  'Data Structures & Algorithms',
  'Operating Systems',
  'Machine Learning',
  'Computer Networks',
  'Discrete Mathematics',
]

const INITIAL_FORM = {
  title: '',
  description: '',
  subject: '',
  semester: 5,
  resourceType: 'pdf',
  url: '',
  tags: '',
}

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-none transition'
const LABEL_CLASS = 'mb-1 block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider'

function Resources() {
  const { state } = useLocation()
  const [resources, setResources] = useState(MOCK_RESOURCES)
  const [selectedSem, setSelectedSem] = useState('All')
  const [selectedFormat, setSelectedFormat] = useState('all')
  const [selectedSubject, setSelectedSubject] = useState('All Subjects')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(Boolean(state?.openAdd))
  const [formData, setFormData] = useState(INITIAL_FORM)

  const filteredResources = resources.filter((res) => {
    if (selectedSem !== 'All' && res.semester !== Number(selectedSem)) return false
    if (selectedFormat !== 'all' && res.resourceType !== selectedFormat) return false
    if (selectedSubject !== 'All Subjects' && res.subject !== selectedSubject) return false

    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      res.title.toLowerCase().includes(q) ||
      res.subject.toLowerCase().includes(q) ||
      res.description?.toLowerCase().includes(q) ||
      res.tags?.some((t) => t.toLowerCase().includes(q))
    )
  })

  const handleAddResource = (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.subject.trim() || !formData.url.trim()) return

    const tags = formData.tags
      ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const newRes = {
      id: `res-${Date.now()}`,
      title: formData.title.trim(),
      description: formData.description.trim() || 'Shared study resource.',
      subject: formData.subject.trim(),
      semester: Number(formData.semester),
      resourceType: formData.resourceType,
      url: formData.url.trim(),
      tags,
      createdAt: new Date().toISOString(),
    }

    setResources((prev) => [newRes, ...prev])
    setFormData(INITIAL_FORM)
    setIsAddOpen(false)
  }

  const getFormatIcon = (type) => {
    switch (type) {
      case 'pdf':
        return <FileText size={20} className="text-[#AA2347]" />
      case 'video':
        return <Video size={20} className="text-sky-500" />
      case 'link':
        return <ExternalLink size={20} className="text-emerald-500" />
      default:
        return <BookOpen size={20} className="text-amber-500" />
    }
  }

  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. NOTENEST HERO HEADER (Campus Compass Vault style) ── */}
      <div className="border-b border-[var(--cm-border)] bg-[var(--cm-surface)] py-8 shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3.5 py-1 text-xs font-semibold text-[var(--cm-muted)]">
                <BookOpen size={15} className="text-[#AA2347] dark:text-[#FFC72C]" />
                <span>Academic Vault & Curated Study Materials</span>
              </div>
              <h1 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--cm-text)]">
                NoteNest: Academic Resource Vault 📖
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-[var(--cm-muted)] leading-relaxed">
                Handwritten notes, textbook PDF drive links, previous year question papers (PYQs), and cheat sheets curated by university toppers.
              </p>
            </div>

            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#AA2347]/20 hover:brightness-110 transition cursor-pointer"
            >
              <Plus size={16} /> Upload Notes / Drive Link
            </button>
          </div>

          {/* Quick Semester Selector Pills */}
          <div className="pt-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)] mr-2">
                Choose Semester:
              </span>
              {SEMESTERS.map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSelectedSem(sem)}
                  className={`rounded-xl px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                    selectedSem === sem
                      ? 'bg-[var(--cm-accent)] text-white shadow-xs'
                      : 'border border-[var(--cm-border)] bg-[var(--cm-bg)] text-[var(--cm-muted)] hover:border-[var(--cm-accent)]/60'
                  }`}
                >
                  {sem === 'All' ? 'All Semesters' : `Semester ${sem}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* ── 2. FORMAT FILTERS & SEARCH BAR ── */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          {/* Format Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-1 text-xs shadow-2xs">
            {FORMAT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedFormat(tab.id)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  selectedFormat === tab.id
                    ? 'bg-[var(--cm-secondary)] font-extrabold text-[var(--cm-text)] shadow-xs'
                    : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-96">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search syllabus, subjects, normalization..."
              className="w-full rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] py-2.5 pr-4 pl-10 text-xs text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-accent)] focus:outline-none transition shadow-2xs"
            />
          </div>
        </div>

        {/* ── 3. SUBJECT CHIPS ── */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 text-xs">
          {SUBJECT_SHORTCUTS.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                selectedSubject === sub
                  ? 'bg-[var(--cm-text)] text-[var(--cm-surface)] shadow-xs'
                  : 'border border-[var(--cm-border)] bg-[var(--cm-surface)] text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* ── 4. RESOURCE CARDS GRID ── */}
        {filteredResources.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No study resources found"
            description="Try selecting another semester or search query."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((res) => (
              <div
                key={res.id}
                className="flex flex-col justify-between rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-xs hover:border-[var(--cm-accent)]/80 hover:shadow-md transition-all duration-300 group"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] shadow-2xs">
                      {getFormatIcon(res.resourceType)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-lg bg-[#AA2347]/10 text-[#AA2347] dark:text-[#FFC72C] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Sem {res.semester}
                      </span>
                      <span className="rounded-lg bg-[var(--cm-secondary)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--cm-muted)] uppercase tracking-wider">
                        {res.resourceType}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-['Poppins'] text-base font-bold text-[var(--cm-text)] group-hover:text-[#AA2347] transition line-clamp-1">
                      {res.title}
                    </h3>
                    <p className="mt-0.5 text-xs font-bold text-[var(--cm-muted)]">
                      {res.subject}
                    </p>
                  </div>

                  <p className="text-xs text-[var(--cm-muted)] line-clamp-2 leading-relaxed">
                    {res.description}
                  </p>

                  {/* Tags */}
                  {res.tags && res.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {res.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-[var(--cm-bg)] border border-[var(--cm-border)]/60 px-2.5 py-0.5 text-[10px] font-medium text-[var(--cm-muted)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-[var(--cm-border)]/60 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ Verified Material
                  </span>
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--cm-secondary)] px-3.5 py-2 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-accent)] hover:text-white transition shadow-2xs"
                  >
                    Open Link <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ADD RESOURCE MODAL ── */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Upload Study Resource">
        <form onSubmit={handleAddResource} className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Resource Title</label>
            <input
              type="text"
              required
              placeholder="e.g. DBMS Unit 1–4 Exam Revision Notes"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Course / Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Database Systems"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className={INPUT_CLASS}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Format</label>
              <select
                value={formData.resourceType}
                onChange={(e) => setFormData({ ...formData, resourceType: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="pdf">PDF Document</option>
                <option value="link">Web Document / Link</option>
                <option value="video">Video Lecture</option>
                <option value="note">Handwritten Note</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Resource URL / Drive Link</label>
              <input
                type="url"
                required
                placeholder="https://drive.google.com/..."
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Tags (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. SQL, normalization, midterms, PYQ"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Summary & Description</label>
            <textarea
              rows={3}
              placeholder="Brief summary of units covered, formula sheets, or exam tips..."
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
              className="rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#AA2347]/20 hover:brightness-110 transition cursor-pointer"
            >
              Share Notes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Resources
