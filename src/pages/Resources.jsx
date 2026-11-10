import { useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { BookOpen, Plus, Search, ExternalLink } from 'lucide-react'
import Badge, { resourceTypeBadge } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_RESOURCES } from '../utils/mockData'

const inp = 'w-full px-3 py-2 bg-[var(--cm-surface)] border border-[var(--cm-border)] rounded-lg text-sm text-[var(--cm-text)] focus:outline-none focus:border-[var(--cm-muted)]'
const lbl = 'block text-xs font-medium text-[var(--cm-muted)] mb-1.5'
const SEMS = ['all', 1, 2, 3, 4, 5, 6, 7, 8]
const TYPES = [{ id: 'all', label: 'All Types' }, { id: 'pdf', label: 'PDF Notes' }, { id: 'link', label: 'Web Links' }, { id: 'video', label: 'Videos' }, { id: 'note', label: 'Notes' }]
const emptyForm = { title: '', description: '', subject: '', semester: 5, resourceType: 'link', url: '', tags: '' }

function Resources() {
  const { state } = useLocation()
  const [resources, setResources] = useState(MOCK_RESOURCES)
  const [sem, setSem] = useState('all')
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(Boolean(state?.openAdd))
  const [form, setForm] = useState(emptyForm)
  const [err, setErr] = useState('')

  const filtered = useMemo(() =>
    resources
      .filter(r => {
        if (sem !== 'all' && r.semester !== Number(sem)) return false
        if (type !== 'all' && r.resourceType !== type) return false
        if (search.trim()) {
          const q = search.toLowerCase()
          if (!r.title.toLowerCase().includes(q) && !r.subject.toLowerCase().includes(q) && !r.description?.toLowerCase().includes(q) && !r.tags?.some(t => t.toLowerCase().includes(q))) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [resources, sem, type, search]
  )

  const submit = e => {
    e.preventDefault()
    if (!form.title.trim()) return setErr('Title is required.')
    if (!form.subject.trim()) return setErr('Subject is required.')
    if (!form.url.trim()) return setErr('URL is required.')
    const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    setResources(p => [{ id: `res-${Date.now()}`, ...form, semester: Number(form.semester), tags, createdAt: new Date().toISOString() }, ...p])
    setAddOpen(false)
  }

  const openAdd = () => { setForm(emptyForm); setErr(''); setAddOpen(true) }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--cm-border)] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>NoteNest</h1>
          <p className="text-sm text-[var(--cm-muted)] mt-1">Access and contribute verified syllabus notes, slides and tutorials.</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--cm-accent)] text-[var(--cm-accent-text)] rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"><Plus size={16} /> Add Resource</button>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes, textbooks, topics or tags..." className="w-full pl-9 pr-3 py-2.5 bg-[var(--cm-card)] border border-[var(--cm-border)] rounded-lg text-sm text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:outline-none focus:border-[var(--cm-muted)]" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-[var(--cm-muted)] uppercase tracking-wider mr-1 flex-shrink-0">Semester:</span>
          {SEMS.map(s => (
            <button key={s} onClick={() => setSem(s)} className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 border ${sem === s ? 'border-[var(--cm-text)] bg-[var(--cm-accent)] text-[var(--cm-accent-text)]' : 'border-[var(--cm-border)] bg-[var(--cm-card)] text-[var(--cm-muted)] hover:text-[var(--cm-text)]'}`}>{s === 'all' ? 'All' : `Sem ${s}`}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-[var(--cm-muted)] uppercase tracking-wider mr-1 flex-shrink-0">Format:</span>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 border ${type === t.id ? 'border-[var(--cm-text)] bg-[var(--cm-accent)] text-[var(--cm-accent-text)]' : 'border-[var(--cm-border)] bg-[var(--cm-card)] text-[var(--cm-muted)] hover:text-[var(--cm-text)]'}`}>{t.label}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No resources found" description="Try a different semester or clear your search." action={{ label: 'Share a Resource', onClick: openAdd }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(res => {
            const tb = resourceTypeBadge(res.resourceType)
            return (
              <div key={res.id} className="bg-[var(--cm-card)] rounded-lg border border-[var(--cm-border)] p-5 transition-colors hover:border-[var(--cm-muted)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Badge variant={tb.variant}>{tb.label}</Badge>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--cm-secondary)] text-[var(--cm-text)] font-medium">Sem {res.semester}</span>
                  </div>
                  <h3 className="font-semibold text-base text-[var(--cm-text)] mb-1.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{res.title}</h3>
                  <p className="text-xs font-medium text-[var(--cm-muted)] mb-2">{res.subject}</p>
                  <p className="text-xs text-[var(--cm-muted)] line-clamp-3 mb-4">{res.description}</p>
                  {res.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {res.tags.map(tag => <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-[var(--cm-secondary)] text-[var(--cm-muted)]">#{tag}</span>)}
                    </div>
                  )}
                </div>
                <div className="pt-3 border-t border-[var(--cm-border)]/60">
                  <a href={res.url} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-1.5 py-2 border border-[var(--cm-border)] bg-[var(--cm-secondary)] text-[var(--cm-text)] rounded-md text-xs font-medium hover:opacity-90 transition-opacity">
                    Open Resource <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Share Study Material" size="md">
        <form onSubmit={submit} className="space-y-3.5">
          {err && <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-xs text-rose-700 dark:text-rose-300">{err}</div>}
          <div><label className={lbl}>Resource Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. OS Handwritten Notes" className={inp} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Subject *</label><input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Operating Systems" className={inp} /></div>
            <div>
              <label className={lbl}>Semester</label>
              <select value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} className={inp}>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Resource Type</label>
              <select value={form.resourceType} onChange={e => setForm(f => ({ ...f, resourceType: e.target.value }))} className={inp}>
                {[['pdf','PDF Document'],['link','Web Link'],['video','Video Tutorial'],['note','Short Note'],['other','Other']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className={lbl}>URL / Drive Link *</label><input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://drive.google.com/..." className={inp} /></div>
          </div>
          <div><label className={lbl}>Tags (comma separated)</label><input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. OS, threads, scheduling" className={inp} /></div>
          <div><label className={lbl}>Description</label><textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this cover? Any tips?" className={`${inp} resize-none`} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-lg border border-[var(--cm-border)] text-xs font-medium text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-[var(--cm-accent)] text-[var(--cm-accent-text)] rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">Save Resource</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Resources
