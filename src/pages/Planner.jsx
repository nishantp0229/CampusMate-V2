// src/pages/Planner.jsx — Interactive Academic Planner inspired by Campus Compass Academics

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  BookOpen,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { MOCK_TASKS, MOCK_TODAY_SCHEDULE } from '../utils/mockData'

const WEEK_SCHEDULE = {
  Mon: [
    { time: '09:00 AM', title: 'Data Structures & Algorithms', type: 'Class', room: 'Room 204, Academic Block' },
    { time: '11:00 AM', title: 'Mathematics III — Linear Algebra', type: 'Class', room: 'Room 108, Science Block' },
    { time: '02:00 PM', title: 'Data Structures Practical Lab', type: 'Lab', room: 'Lab 1, CSE Block' },
  ],
  Tue: [
    { time: '10:00 AM', title: 'Database Management Systems', type: 'Class', room: 'Room 302, Academic Block' },
    { time: '12:00 PM', title: 'Computer Networks', type: 'Class', room: 'Room 204, Academic Block' },
    { time: '03:00 PM', title: 'Operating Systems Tutorial', type: 'Tutorial', room: 'Room 112, CSE Block' },
  ],
  Wed: MOCK_TODAY_SCHEDULE.map((s) => ({ time: s.time, title: s.title, type: s.type, room: s.location })),
  Thu: [
    { time: '09:00 AM', title: 'Object Oriented Programming in Java', type: 'Class', room: 'Room 205, Academic Block' },
    { time: '11:30 AM', title: 'Computer Networks Lab', type: 'Lab', room: 'Lab 3, CSE Block' },
    { time: '02:30 PM', title: 'Machine Learning Elective', type: 'Class', room: 'Seminar Hall A' },
  ],
  Fri: [
    { time: '10:00 AM', title: 'Applied Physics — Optics & Waves', type: 'Class', room: 'Physics Block 204' },
    { time: '01:30 PM', title: 'Professional Communication Seminar', type: 'Seminar', room: 'Admin Auditorium' },
    { time: '03:30 PM', title: 'ACM Problem Solving Sprint', type: 'Activity', room: 'Innovation Hub' },
  ],
  Sat: [
    { time: '11:00 AM', title: 'Weekend Capstone Project Review', type: 'Mentorship', room: 'SAC 2nd Floor' },
  ],
  Sun: [
    { time: 'All Day', title: 'Self-Study & Assignment Sprint Buffer', type: 'Self Study', room: 'Hostel / Library' },
  ],
}

const WEEK_DAYS = [
  { day: 'Mon', label: 'Monday', date: 9 },
  { day: 'Tue', label: 'Tuesday', date: 10 },
  { day: 'Wed', label: 'Wednesday', date: 11, isToday: true },
  { day: 'Thu', label: 'Thursday', date: 12 },
  { day: 'Fri', label: 'Friday', date: 13 },
  { day: 'Sat', label: 'Saturday', date: 14 },
  { day: 'Sun', label: 'Sunday', date: 15 },
]

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const INITIAL_FORM = { title: '', subject: '', dueDate: '', priority: 'medium' }
const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-none transition'
const LABEL_CLASS = 'mb-1 block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider'

function Planner() {
  const { state } = useLocation()
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [filter, setFilter] = useState('all')
  const [selectedDay, setSelectedDay] = useState('Wed')
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
      subject: formData.subject.trim() || 'General Coursework',
      priority: formData.priority,
      status: 'pending',
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    setTasks((prev) => [newTask, ...prev])
    setFormData(INITIAL_FORM)
    setIsModalOpen(false)
  }

  const filteredTasks = tasks
    .filter((task) => {
      if (filter === 'pending') return task.status === 'pending'
      if (filter === 'completed') return task.status === 'completed'
      if (filter === 'high') return task.priority === 'high'
      return true
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))

  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const weeklyPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0

  const activeDaySchedule = WEEK_SCHEDULE[selectedDay] || []

  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. ACADEMIC HERO BANNER ── */}
      <div className="workspace-page-header border-b border-[var(--cm-border)] bg-[var(--cm-surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <div className="workspace-page-kicker"><span /> ACADEMIC PLANNER / DEMO DATA</div>
              <h1 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--cm-text)]">
                Your academics, in order.
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-[var(--cm-muted)] leading-relaxed">
                Everything you need to know about your coursework, weekly class flows, internal quizzes, and maintaining your target 8.5+ CGPA.
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="workspace-primary-button"
            >
              <Plus size={16} /> Add Academic Task
            </button>
          </div>

          {/* Academic Protection Plan Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8">
            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Target CGPA
              </span>
              <p className="font-['Poppins'] text-2xl font-extrabold text-[var(--cm-accent)] mt-1">
                8.6 / 10
              </p>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                On Track for Honors
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Pending Submissions
              </span>
              <p className="font-['Poppins'] text-2xl font-extrabold text-[var(--cm-text)] mt-1">
                {pendingCount} Tasks
              </p>
              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                DSA AVL Tree due in 2d
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Attendance Standing
              </span>
              <p className="font-['Poppins'] text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                85% Safe
              </p>
              <span className="text-[10px] font-semibold text-[var(--cm-muted)]">
                Threshold: ≥ 75%
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Weekly Progress
              </span>
              <p className="font-['Poppins'] text-2xl font-extrabold text-[var(--cm-text)] mt-1">
                {weeklyPercent}%
              </p>
              <span className="text-[10px] font-semibold text-[var(--cm-accent)]">
                {completedCount} tasks completed
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
        {/* ── 2. INTERACTIVE TIMETABLE & DAY SELECTOR (Campus Compass Week Flow) ── */}
        <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 sm:p-8 shadow-xs">
          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--cm-accent)]">
                <Clock size={13} /> Weekly Agenda
              </div>
              <h2 className="font-['Poppins'] text-xl sm:text-2xl font-extrabold text-[var(--cm-text)]">
                Class, Practical & Tutorial Timetable 📅
              </h2>
              <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
                Select any weekday to view venue locations and faculty halls.
              </p>
            </div>

            <span className="text-xs font-bold text-[var(--cm-muted)] flex items-center gap-1.5">
              <CalendarIcon size={14} className="text-[var(--cm-accent)]" /> November 2026 Academic Term
            </span>
          </div>

          {/* Week Days Strip */}
          <div className="grid grid-cols-7 gap-2 pb-6 border-b border-[var(--cm-border)]/70">
            {WEEK_DAYS.map((item) => {
              const isSelected = selectedDay === item.day
              return (
                <button
                  key={item.day}
                  onClick={() => setSelectedDay(item.day)}
                  className={`flex flex-col items-center justify-center rounded-2xl py-3 px-1 text-center transition cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-md font-bold'
                      : 'border border-[var(--cm-border)]/70 bg-[var(--cm-bg)] text-[var(--cm-muted)] hover:border-[var(--cm-accent)]/60'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider">{item.day}</span>
                  <span className="font-['Poppins'] text-base sm:text-lg font-bold leading-tight">{item.date}</span>
                  {item.isToday && (
                    <span
                      className={`mt-1 text-[8px] font-bold uppercase px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-[var(--cm-accent-text)]/10 text-[var(--cm-accent-text)]' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      Today
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected Day Schedule Cards */}
          <div className="pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)] mb-4">
              Schedule for {WEEK_DAYS.find((d) => d.day === selectedDay)?.label}:
            </h3>

            {activeDaySchedule.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--cm-muted)]">No formal lectures scheduled for this day.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDaySchedule.map((session, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)]/60 p-4.5 hover:border-[var(--cm-accent)]/80 hover:bg-[var(--cm-surface)] transition shadow-2xs group"
                  >
                    <div className="flex items-center justify-between text-xs mb-2.5">
                      <span className="font-mono font-bold text-[var(--cm-text)] flex items-center gap-1.5">
                        <Clock size={13} className="text-[var(--cm-accent)]" /> {session.time}
                      </span>
                      <span
                        className={`rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          session.type === 'Lab'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                            : session.type === 'Exam'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-[var(--cm-secondary)] text-[var(--cm-muted)]'
                        }`}
                      >
                        {session.type}
                      </span>
                    </div>

                    <h4 className="font-semibold text-sm text-[var(--cm-text)] line-clamp-1 group-hover:text-[var(--cm-accent)] transition">
                      {session.title}
                    </h4>

                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--cm-muted)]">
                      <MapPin size={13} className="shrink-0 text-[var(--cm-accent)]" />
                      {session.room}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 3. ACADEMIC SPRINT & SUBMISSIONS TABLE ── */}
        <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 sm:p-8 shadow-xs">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-['Poppins'] text-xl font-extrabold text-[var(--cm-text)]">
                Assignments, Lab Reports & Submissions 📝
              </h2>
              <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
                Mark tasks as completed when uploaded to the university portal.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-1 text-xs">
              {[
                { id: 'all', label: 'All Tasks' },
                { id: 'pending', label: `Pending (${pendingCount})` },
                { id: 'completed', label: `Completed (${completedCount})` },
                { id: 'high', label: 'High Priority' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-lg px-3.5 py-1.5 font-bold transition cursor-pointer ${
                    filter === tab.id
                      ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
                      : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No tasks match this filter"
              description="You have completed all assignments in this view. Use 'Add Academic Task' to schedule a new one."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--cm-border)] text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3">Assignment / Milestone</th>
                    <th className="hidden py-3.5 px-3 md:table-cell">Course Subject</th>
                    <th className="py-3.5 px-3">Priority</th>
                    <th className="py-3.5 px-3 text-right">Submission Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--cm-border)]/60">
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="hover:bg-[var(--cm-secondary)]/30 transition group"
                    >
                      <td className="py-3.5 px-3 w-10">
                        <button
                          onClick={() => toggleComplete(task.id)}
                          className="text-[var(--cm-muted)] hover:text-[var(--cm-accent)] cursor-pointer"
                          aria-label="Toggle task status"
                        >
                          {task.status === 'completed' ? (
                            <CheckCircle2 size={19} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle size={19} />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-3">
                        <p
                          className={`font-bold text-sm ${
                            task.status === 'completed'
                              ? 'line-through text-[var(--cm-muted)]'
                              : 'text-[var(--cm-text)]'
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-[var(--cm-muted)] line-clamp-1 mt-0.5">
                            {task.description}
                          </p>
                        )}
                        <span className="text-[11px] text-[var(--cm-muted)] md:hidden">
                          {task.subject}
                        </span>
                      </td>
                      <td className="hidden py-3.5 px-3 text-xs font-semibold text-[var(--cm-muted)] md:table-cell">
                        {task.subject}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            task.priority === 'high'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap text-xs font-semibold text-[var(--cm-muted)]">
                        {formatDate(task.dueDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── ADD TASK MODAL ── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Academic Assignment">
        <form onSubmit={handleAddTask} className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Assignment Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Implement AVL Tree in C++"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Course / Subject</label>
            <input
              type="text"
              placeholder="e.g. Data Structures & Algorithms"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Priority Level</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--cm-border)]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="workspace-primary-button"
            >
              Add to Schedule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Planner
