import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Calendar, Clock, CheckCircle2, Circle, CheckSquare } from 'lucide-react'
import Badge, { priorityBadge } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_TASKS } from '../utils/mockData'

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const INITIAL_FORM = { title: '', subject: '', dueDate: '', priority: 'medium' }
const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3 py-2 text-sm text-[var(--cm-text)] focus:border-[var(--cm-muted)] focus:outline-none'
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-[var(--cm-muted)]'

function Planner() {
  const { state } = useLocation()
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [filter, setFilter] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(Boolean(state?.openAdd))
  const [formData, setFormData] = useState(INITIAL_FORM)

  const toggleComplete = (taskId) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' }
          : task
      )
    )
  }

  const handleAddTask = (e) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    const newTask = {
      id: `task-${Date.now()}`,
      title: formData.title.trim(),
      subject: formData.subject.trim() || 'General',
      priority: formData.priority,
      status: 'pending',
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : new Date().toISOString(),
    }

    setTasks((prev) => [newTask, ...prev])
    setFormData(INITIAL_FORM)
    setIsModalOpen(false)
  }

  const filteredTasks = tasks.filter((task) => filter === 'all' || task.status === filter)

  const upcomingDeadlines = [...tasks]
    .filter((task) => task.status === 'pending')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 4)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--cm-border)] pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-['Poppins'] text-2xl font-semibold text-[var(--cm-text)]">
            Academic Planner
          </h1>
          <p className="mt-1 text-sm text-[var(--cm-muted)]">
            Keep track of your assignments, subjects, and upcoming deadlines.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[var(--cm-accent)] px-4 py-2 text-xs font-medium text-[var(--cm-accent-text)] transition hover:opacity-90"
        >
          <Plus size={15} /> Add Task
        </button>
      </div>

      {/* Filters */}
      <div className="inline-flex gap-1 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] p-1">
        {['all', 'pending', 'completed'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-md px-4 py-1.5 text-xs font-medium capitalize transition ${
              filter === tab
                ? 'bg-[var(--cm-secondary)] text-[var(--cm-text)]'
                : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Task Cards + Upcoming Deadlines */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No tasks here"
              description="Try switching filters or add a new assignment."
              action={{ label: 'Add Task', onClick: () => setIsModalOpen(true) }}
            />
          ) : (
            filteredTasks.map((task) => {
              const isDone = task.status === 'completed'
              const badge = priorityBadge(task.priority)
              return (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] p-4 transition hover:border-[var(--cm-muted)] ${
                    isDone ? 'opacity-65' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleComplete(task.id)}
                    className="mt-0.5 shrink-0 text-[var(--cm-muted)] transition hover:text-[var(--cm-text)]"
                    aria-label={isDone ? 'Mark as pending' : 'Mark as completed'}
                  >
                    {isDone ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className={`font-['Poppins'] text-sm font-semibold text-[var(--cm-text)] ${isDone ? 'line-through text-[var(--cm-muted)]' : ''}`}>
                        {task.title}
                      </h3>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--cm-muted)]">
                      <span className="rounded bg-[var(--cm-secondary)] px-2 py-0.5 font-medium text-[var(--cm-text)]">
                        {task.subject}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} /> Due {formatDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Upcoming Deadlines */}
        <aside className="h-fit rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-[var(--cm-muted)]" />
            <h2 className="font-['Poppins'] text-sm font-semibold text-[var(--cm-text)]">
              Upcoming Deadlines
            </h2>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-[var(--cm-muted)]">All tasks completed!</p>
          ) : (
            <div className="divide-y divide-[var(--cm-border)]/60">
              {upcomingDeadlines.map((task) => (
                <div key={task.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="truncate text-xs font-medium text-[var(--cm-text)]">{task.title}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--cm-muted)]">
                    <span className="truncate">{task.subject}</span>
                    <span className="shrink-0 font-medium text-[var(--cm-text)]">{formatDate(task.dueDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Add Task Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Task" size="sm">
        <form onSubmit={handleAddTask} className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Task Title *</label>
            <input type="text" required placeholder="e.g. Submit OS Lab Report" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Subject</label>
            <input type="text" placeholder="e.g. Operating Systems" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className={INPUT_CLASS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Due Date</label>
              <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Priority</label>
              <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className={INPUT_CLASS}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-[var(--cm-border)] px-4 py-2 text-xs font-medium text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]">Cancel</button>
            <button type="submit" className="rounded-lg bg-[var(--cm-accent)] px-4 py-2 text-xs font-medium text-[var(--cm-accent-text)] hover:opacity-90">Add Task</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Planner
