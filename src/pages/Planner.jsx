// src/pages/Planner.jsx — Academic Planner module
// Allows students to view, filter, add, edit, and complete assignments/tasks.

import { useState, useMemo } from 'react'
import {
  Plus, Search, CheckSquare, Square, Trash2, Edit2,
  Clock, CheckCircle2
} from 'lucide-react'
import Badge, { priorityBadge } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_TASKS } from '../utils/mockData'

function Planner() {
  // State for all tasks (initialized from realistic mock data)
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'pending' | 'completed'
  const [priorityFilter, setPriorityFilter] = useState('all') // 'all' | 'low' | 'medium' | 'high'

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    description: '',
    priority: 'medium',
    dueDate: '',
  })
  const [formError, setFormError] = useState('')

  // Filtered & sorted tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (statusFilter !== 'all' && task.status !== statusFilter) return false
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchTitle = task.title.toLowerCase().includes(q)
          const matchSubject = task.subject?.toLowerCase().includes(q)
          if (!matchTitle && !matchSubject) return false
        }
        return true
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [tasks, statusFilter, priorityFilter, searchQuery])

  // Counts
  const totalCount = tasks.length
  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  // Handlers
  const handleToggleStatus = (id) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' }
          : t
      )
    )
  }

  const handleDeleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const handleOpenAdd = () => {
    setEditingTask(null)
    setFormData({
      title: '',
      subject: '',
      description: '',
      priority: 'medium',
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    })
    setFormError('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      subject: task.subject || '',
      description: task.description || '',
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
    })
    setFormError('')
    setIsModalOpen(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setFormError('Task title is required.')
      return
    }

    if (editingTask) {
      setTasks(prev =>
        prev.map(t =>
          t.id === editingTask.id
            ? {
                ...t,
                title: formData.title.trim(),
                subject: formData.subject.trim(),
                description: formData.description.trim(),
                priority: formData.priority,
                dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : t.dueDate,
              }
            : t
        )
      )
    } else {
      const newTask = {
        id: `task-${Date.now()}`,
        title: formData.title.trim(),
        subject: formData.subject.trim() || 'General',
        description: formData.description.trim(),
        priority: formData.priority,
        status: 'pending',
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }
      setTasks(prev => [newTask, ...prev])
    }

    setIsModalOpen(false)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No due date'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-[#242B3A] dark:text-[#F1F1FC]"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Academic Planner
          </h1>
          <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] mt-1">
            Organize assignments, lab reports and exam preparations.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#A9C9FF] text-white rounded-xl font-medium text-sm hover:bg-[#8BB8F8] transition-colors shadow-sm"
        >
          <Plus size={16} />
          Add Task
        </button>
      </div>

      {/* ══ STATS CHIPS ══════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#252A3C] border border-[#E2E8F0] dark:border-white/[0.07] text-xs font-medium text-[#737B8C] dark:text-[#A0A8B8]">
          Total: <strong className="text-[#242B3A] dark:text-[#F1F1FC] ml-1">{totalCount}</strong>
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-400">
          Pending: <strong className="ml-1">{pendingCount}</strong>
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 text-xs font-medium text-green-700 dark:text-green-400">
          Completed: <strong className="ml-1">{completedCount}</strong>
        </span>
      </div>

      {/* ══ FILTERS & SEARCH BAR ═════════════════════════════════ */}
      <div className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-3.5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737B8C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks or subjects..."
            className="w-full pl-9 pr-3 py-2 bg-[#F7F8FC] dark:bg-[#171A29] border border-transparent rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] placeholder-[#737B8C] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 bg-[#F7F8FC] dark:bg-[#171A29] p-1 rounded-xl">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'completed', label: 'Completed' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-[#252A3C] text-[#242B3A] dark:text-[#F1F1FC] shadow-sm'
                  : 'text-[#737B8C] dark:text-[#A0A8B8] hover:text-[#242B3A] dark:hover:text-[#F1F1FC]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 bg-[#F7F8FC] dark:bg-[#171A29] border border-transparent rounded-xl text-xs text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
        >
          <option value="all">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>
      </div>

      {/* ══ TASK LIST ════════════════════════════════════════════ */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks found"
            description="Try adjusting your filters, or create a new assignment task to get started."
            action={{ label: 'Add New Task', onClick: handleOpenAdd }}
          />
        ) : (
          filteredTasks.map(task => {
            const isCompleted = task.status === 'completed'
            const pBadge = priorityBadge(task.priority)

            return (
              <div
                key={task.id}
                className={`bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-4 shadow-sm hover:shadow-md transition-all flex items-start gap-3 ${
                  isCompleted ? 'opacity-70' : ''
                }`}
              >
                {/* Complete checkbox button */}
                <button
                  onClick={() => handleToggleStatus(task.id)}
                  className="mt-0.5 text-[#A9C9FF] hover:text-[#5B9BF8] transition-colors flex-shrink-0"
                  aria-label={isCompleted ? 'Mark pending' : 'Mark completed'}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={20} className="text-[#6BCB9A]" />
                  ) : (
                    <Square size={20} className="text-[#737B8C] hover:text-[#A9C9FF]" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3
                      className={`font-semibold text-sm text-[#242B3A] dark:text-[#F1F1FC] ${
                        isCompleted ? 'line-through text-[#737B8C] dark:text-[#A0A8B8]' : ''
                      }`}
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      {task.title}
                    </h3>
                    <Badge variant={pBadge.variant}>{pBadge.label}</Badge>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-[#EAF2FF] dark:bg-[#A9C9FF]/10 text-[#5B9BF8] dark:text-[#A9C9FF]">
                      {task.subject}
                    </span>
                  </div>

                  {task.description && (
                    <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] line-clamp-2 mb-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-[#737B8C] dark:text-[#A0A8B8]">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Due: {formatDate(task.dueDate)}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleOpenEdit(task)}
                    className="p-1.5 rounded-lg text-[#737B8C] hover:text-[#5B9BF8] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.05] transition-colors"
                    aria-label="Edit task"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 rounded-lg text-[#737B8C] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    aria-label="Delete task"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ══ ADD / EDIT MODAL ═════════════════════════════════════ */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTask ? 'Edit Assignment' : 'Add New Assignment'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Task Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Implement AVL Tree in C++"
              required
              className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData(f => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Data Structures"
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'low', label: 'Low', activeClass: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
                { id: 'medium', label: 'Medium', activeClass: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
                { id: 'high', label: 'High', activeClass: 'border-red-500 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, priority: opt.id }))}
                  className={`py-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                    formData.priority === opt.id
                      ? opt.activeClass
                      : 'border-[#E2E8F0] dark:border-white/[0.07] text-[#737B8C] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.03]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="Additional notes, submission links, or instructions..."
              className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.1] text-xs font-medium text-[#737B8C] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#A9C9FF] text-white rounded-xl text-xs font-medium hover:bg-[#8BB8F8] transition-colors"
            >
              {editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Planner
