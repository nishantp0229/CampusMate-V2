// src/pages/Planner.jsx — Interactive Academic Planner connected to Supabase
// Includes: Course Tasks/Assignments, Subject-Wise Editable Attendance, and Weekly Timetable

import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Loader2,
  AlertCircle,
  Trash2,
  Edit2,
  Check,
  TrendingUp,
  MapPin,
  User,
  AlertTriangle,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const DAYS_OF_WEEK = [
  { day: 'Mon', label: 'Monday' },
  { day: 'Tue', label: 'Tuesday' },
  { day: 'Wed', label: 'Wednesday' },
  { day: 'Thu', label: 'Thursday' },
  { day: 'Fri', label: 'Friday' },
  { day: 'Sat', label: 'Saturday' },
  { day: 'Sun', label: 'Sunday' },
]

const getTodayShort = () => {
  const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return map[new Date().getDay()]
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'No due date'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatTime12 = (timeStr) => {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let hours = parseInt(parts[0], 10)
  const minutes = parts[1]
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

const INITIAL_TASK_FORM = { title: '', subject: '', dueDate: '', priority: 'medium' }
const INITIAL_ATTENDANCE_FORM = { subject: '', total_classes: 0, attended_classes: 0 }
const INITIAL_TIMETABLE_FORM = {
  day: 'Mon',
  subject: '',
  start_time: '09:00',
  end_time: '10:00',
  room: '',
  instructor: '',
  class_type: 'Class',
}

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-none transition'
const LABEL_CLASS = 'mb-1 block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider'

function Planner() {
  const { state } = useLocation()
  const { user } = useAuth()
  const todayShort = getTodayShort()

  // ─── TASKS STATE ───────────────────────────────────────────
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(Boolean(state?.openAdd))
  const [taskForm, setTaskForm] = useState(INITIAL_TASK_FORM)
  const [submittingTask, setSubmittingTask] = useState(false)

  // ─── ATTENDANCE STATE ──────────────────────────────────────
  const [attendance, setAttendance] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(true)
  const [attendanceDbNotice, setAttendanceDbNotice] = useState(null)
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)
  const [editingAttendanceId, setEditingAttendanceId] = useState(null)
  const [attendanceForm, setAttendanceForm] = useState(INITIAL_ATTENDANCE_FORM)
  const [attendanceError, setAttendanceError] = useState('')
  const [submittingAttendance, setSubmittingAttendance] = useState(false)

  // ─── TIMETABLE STATE ───────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState(todayShort === 'Sun' ? 'Mon' : todayShort)
  const [timetable, setTimetable] = useState([])
  const [timetableLoading, setTimetableLoading] = useState(true)
  const [timetableDbNotice, setTimetableDbNotice] = useState(null)
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false)
  const [editingTimetableId, setEditingTimetableId] = useState(null)
  const [timetableForm, setTimetableForm] = useState({ ...INITIAL_TIMETABLE_FORM, day: selectedDay })
  const [timetableError, setTimetableError] = useState('')
  const [submittingTimetable, setSubmittingTimetable] = useState(false)

  // ───────────────────────────────────────────────────────────
  // 1. FETCH TASKS FROM SUPABASE
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true

    if (!supabase || !user?.id) {
      setTasks([])
      setLoading(false)
      return
    }

    const fetchTasks = async () => {
      try {
        if (isMounted) {
          setLoading(true)
          setError(null)
        }

        const { data, error: fetchErr } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('due_date', { ascending: true })

        if (!isMounted) return

        if (fetchErr) {
          console.error('[CampusMate] Error fetching tasks:', fetchErr.message)
          setError('Failed to load assignments from database.')
        } else {
          setTasks(
            (data || []).map((t) => ({
              id: t.id,
              user_id: t.user_id,
              title: t.title,
              subject: t.subject || 'General Coursework',
              description: t.description || '',
              priority: t.priority || 'medium',
              status: t.status || 'pending',
              dueDate: t.due_date,
              createdAt: t.created_at,
            }))
          )
        }
      } catch (err) {
        if (isMounted) {
          console.error('[CampusMate] Exception fetching tasks:', err)
          setError('An error occurred while loading assignments.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchTasks()

    return () => {
      isMounted = false
    }
  }, [user?.id])

  // ───────────────────────────────────────────────────────────
  // 2. FETCH ATTENDANCE DIRECTLY FROM SUPABASE
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true
    if (!user?.id || !supabase) {
      setAttendance([])
      setAttendanceLoading(false)
      return
    }

    const fetchAttendance = async () => {
      try {
        if (isMounted) {
          setAttendanceLoading(true)
          setAttendanceDbNotice(null)
        }

        const { data, error: attErr } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .order('subject', { ascending: true })

        if (!isMounted) return

        if (attErr) {
          console.warn('[CampusMate] Attendance fetch notice:', attErr.message)
          setAttendanceDbNotice(
            `Attendance table not found in Supabase (${attErr.message}). Execute database/migration_admin_academic.sql in your Supabase SQL Editor to enable attendance sync.`
          )
          setAttendance([])
        } else {
          setAttendance(data || [])
          setAttendanceDbNotice(null)
        }
      } catch (err) {
        if (isMounted) {
          console.error('[CampusMate] Attendance exception:', err)
          setAttendanceDbNotice('Unable to connect to Supabase attendance table.')
        }
      } finally {
        if (isMounted) setAttendanceLoading(false)
      }
    }

    fetchAttendance()
    return () => {
      isMounted = false
    }
  }, [user?.id])

  // ───────────────────────────────────────────────────────────
  // 3. FETCH TIMETABLE DIRECTLY FROM SUPABASE
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true
    if (!user?.id || !supabase) {
      setTimetable([])
      setTimetableLoading(false)
      return
    }

    const fetchTimetable = async () => {
      try {
        if (isMounted) {
          setTimetableLoading(true)
          setTimetableDbNotice(null)
        }

        const { data, error: ttErr } = await supabase
          .from('timetable')
          .select('*')
          .eq('user_id', user.id)
          .order('start_time', { ascending: true })

        if (!isMounted) return

        if (ttErr) {
          console.warn('[CampusMate] Timetable fetch notice:', ttErr.message)
          setTimetableDbNotice(
            `Timetable table not found in Supabase (${ttErr.message}). Execute database/migration_admin_academic.sql in your Supabase SQL Editor to enable timetable sync.`
          )
          setTimetable([])
        } else {
          setTimetable(data || [])
          setTimetableDbNotice(null)
        }
      } catch (err) {
        if (isMounted) {
          console.error('[CampusMate] Timetable exception:', err)
          setTimetableDbNotice('Unable to connect to Supabase timetable table.')
        }
      } finally {
        if (isMounted) setTimetableLoading(false)
      }
    }

    fetchTimetable()
    return () => {
      isMounted = false
    }
  }, [user?.id])

  // ───────────────────────────────────────────────────────────
  // TASK HANDLERS
  // ───────────────────────────────────────────────────────────
  const toggleComplete = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !supabase || !user?.id) return

    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))

    const { error: updateErr } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (updateErr) {
      console.error('[CampusMate] Error updating task status:', updateErr.message)
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)))
    }
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!taskForm.title.trim() || !supabase || !user?.id) return

    try {
      setSubmittingTask(true)
      const payload = {
        user_id: user.id,
        title: taskForm.title.trim(),
        subject: taskForm.subject.trim() || 'General Coursework',
        priority: taskForm.priority,
        status: 'pending',
        due_date: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : new Date().toISOString(),
      }

      const { data, error: insertErr } = await supabase
        .from('tasks')
        .insert(payload)
        .select()
        .single()

      if (insertErr) {
        console.error('[CampusMate] Error inserting task:', insertErr.message)
        alert('Could not save task to database: ' + insertErr.message)
      } else if (data) {
        setTasks((prev) => [
          {
            id: data.id,
            user_id: data.user_id,
            title: data.title,
            subject: data.subject,
            description: data.description,
            priority: data.priority,
            status: data.status,
            dueDate: data.due_date,
            createdAt: data.created_at,
          },
          ...prev,
        ])
        setTaskForm(INITIAL_TASK_FORM)
        setIsTaskModalOpen(false)
      }
    } catch (err) {
      console.error('[CampusMate] Exception creating task:', err)
    } finally {
      setSubmittingTask(false)
    }
  }

  // ───────────────────────────────────────────────────────────
  // ATTENDANCE HANDLERS (STRICT SUPABASE ONLY)
  // ───────────────────────────────────────────────────────────
  const handleOpenAttendanceModal = (record = null) => {
    setAttendanceError('')
    if (record) {
      setEditingAttendanceId(record.id)
      setAttendanceForm({
        subject: record.subject,
        total_classes: record.total_classes,
        attended_classes: record.attended_classes,
      })
    } else {
      setEditingAttendanceId(null)
      setAttendanceForm(INITIAL_ATTENDANCE_FORM)
    }
    setIsAttendanceModalOpen(true)
  }

  const handleSaveAttendance = async (e) => {
    e.preventDefault()
    if (!user?.id || !supabase) return

    const subject = attendanceForm.subject.trim()
    const total = Math.max(0, parseInt(attendanceForm.total_classes, 10) || 0)
    const attended = Math.max(0, parseInt(attendanceForm.attended_classes, 10) || 0)

    if (!subject) {
      setAttendanceError('Please enter a subject name.')
      return
    }
    if (attended > total) {
      setAttendanceError('Attended classes cannot exceed total classes conducted.')
      return
    }

    setSubmittingAttendance(true)
    setAttendanceError('')

    const payload = {
      user_id: user.id,
      subject,
      total_classes: total,
      attended_classes: attended,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editingAttendanceId) {
        const { data, error: updateErr } = await supabase
          .from('attendance')
          .update(payload)
          .eq('id', editingAttendanceId)
          .eq('user_id', user.id)
          .select()
          .single()

        if (updateErr) {
          setAttendanceError(`Database error: ${updateErr.message}. Ensure database/migration_admin_academic.sql was executed in Supabase.`)
          return
        }

        setAttendance((prev) => prev.map((a) => (a.id === editingAttendanceId ? data : a)))
      } else {
        const { data, error: insertErr } = await supabase
          .from('attendance')
          .insert(payload)
          .select()
          .single()

        if (insertErr) {
          setAttendanceError(`Database error: ${insertErr.message}. Ensure database/migration_admin_academic.sql was executed in Supabase.`)
          return
        }

        setAttendance((prev) => [data, ...prev])
      }

      setIsAttendanceModalOpen(false)
      setAttendanceForm(INITIAL_ATTENDANCE_FORM)
      setAttendanceDbNotice(null)
    } catch (err) {
      console.error('[CampusMate] Error saving attendance:', err)
      setAttendanceError('Could not save attendance to database. Please check your Supabase connection.')
    } finally {
      setSubmittingAttendance(false)
    }
  }

  const handleQuickLog = async (id, type) => {
    const item = attendance.find((a) => a.id === id)
    if (!item || !user?.id || !supabase) return

    let nextTotal = item.total_classes + 1
    let nextAttended = type === 'attended' ? item.attended_classes + 1 : item.attended_classes

    // Optimistic UI update
    setAttendance((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, total_classes: nextTotal, attended_classes: nextAttended } : a
      )
    )

    const { error: logErr } = await supabase
      .from('attendance')
      .update({
        total_classes: nextTotal,
        attended_classes: nextAttended,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (logErr) {
      alert(`Database update failed: ${logErr.message}. Please verify the attendance table exists in Supabase.`)
      // Revert on failure
      setAttendance((prev) => prev.map((a) => (a.id === id ? item : a)))
    }
  }

  const handleDeleteAttendance = async (id) => {
    if (!window.confirm('Are you sure you want to remove this subject from your attendance tracker?')) return
    if (!user?.id || !supabase) return

    const { error: delErr } = await supabase
      .from('attendance')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (delErr) {
      alert(`Failed to delete subject: ${delErr.message}. Please verify the attendance table exists in Supabase.`)
      return
    }

    setAttendance((prev) => prev.filter((a) => a.id !== id))
  }

  // ───────────────────────────────────────────────────────────
  // TIMETABLE HANDLERS (STRICT SUPABASE ONLY)
  // ───────────────────────────────────────────────────────────
  const handleOpenTimetableModal = (record = null) => {
    setTimetableError('')
    if (record) {
      setEditingTimetableId(record.id)
      setTimetableForm({
        day: record.day,
        subject: record.subject,
        start_time: record.start_time?.substring(0, 5) || '09:00',
        end_time: record.end_time?.substring(0, 5) || '10:00',
        room: record.room || '',
        instructor: record.instructor || '',
        class_type: record.class_type || 'Class',
      })
    } else {
      setEditingTimetableId(null)
      setTimetableForm({ ...INITIAL_TIMETABLE_FORM, day: selectedDay })
    }
    setIsTimetableModalOpen(true)
  }

  const handleSaveTimetable = async (e) => {
    e.preventDefault()
    if (!user?.id || !supabase) return

    const subject = timetableForm.subject.trim()
    const { day, start_time, end_time, room, instructor, class_type } = timetableForm

    if (!subject) {
      setTimetableError('Please enter a subject or class title.')
      return
    }
    if (!start_time || !end_time) {
      setTimetableError('Start time and end time are required.')
      return
    }
    if (start_time >= end_time) {
      setTimetableError('End time must be later than start time.')
      return
    }

    setSubmittingTimetable(true)
    setTimetableError('')

    const payload = {
      user_id: user.id,
      day,
      subject,
      start_time,
      end_time,
      room: room.trim() || null,
      instructor: instructor.trim() || null,
      class_type: class_type || 'Class',
      updated_at: new Date().toISOString(),
    }

    try {
      if (editingTimetableId) {
        const { data, error: updateErr } = await supabase
          .from('timetable')
          .update(payload)
          .eq('id', editingTimetableId)
          .eq('user_id', user.id)
          .select()
          .single()

        if (updateErr) {
          setTimetableError(`Database error: ${updateErr.message}. Ensure database/migration_admin_academic.sql was executed in Supabase.`)
          return
        }

        setTimetable((prev) => prev.map((t) => (t.id === editingTimetableId ? data : t)))
      } else {
        const { data, error: insertErr } = await supabase
          .from('timetable')
          .insert(payload)
          .select()
          .single()

        if (insertErr) {
          setTimetableError(`Database error: ${insertErr.message}. Ensure database/migration_admin_academic.sql was executed in Supabase.`)
          return
        }

        setTimetable((prev) => [...prev, data])
      }

      setIsTimetableModalOpen(false)
      setTimetableForm({ ...INITIAL_TIMETABLE_FORM, day: selectedDay })
      setTimetableDbNotice(null)
    } catch (err) {
      console.error('[CampusMate] Error saving timetable:', err)
      setTimetableError('Could not save class entry. Please check your Supabase connection.')
    } finally {
      setSubmittingTimetable(false)
    }
  }

  const handleDeleteTimetable = async (id) => {
    if (!window.confirm('Remove this class from your timetable?')) return
    if (!user?.id || !supabase) return

    const { error: delErr } = await supabase
      .from('timetable')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (delErr) {
      alert(`Failed to delete class: ${delErr.message}. Please verify the timetable table exists in Supabase.`)
      return
    }

    setTimetable((prev) => prev.filter((t) => t.id !== id))
  }

  // ───────────────────────────────────────────────────────────
  // CALCULATIONS & METRICS
  // ───────────────────────────────────────────────────────────
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

  // Overall Attendance Calculation (Attended / Total * 100)
  const totalConducted = attendance.reduce((acc, curr) => acc + (Number(curr.total_classes) || 0), 0)
  const totalAttended = attendance.reduce((acc, curr) => acc + (Number(curr.attended_classes) || 0), 0)
  const overallAttendanceRate = totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100) : 0

  // Filtered Timetable for Selected Day
  const dayClasses = timetable
    .filter((item) => item.day === selectedDay)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. ACADEMIC HERO BANNER ── */}
      <div className="workspace-page-header border-b border-[var(--cm-border)] bg-[var(--cm-surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <div className="workspace-page-kicker"><span /> ACADEMIC PLANNER · TASKS & SCHEDULE</div>
              <h1 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--cm-text)]">
                Your academics, in order.
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-[var(--cm-muted)] leading-relaxed">
                Everything you need to know about your coursework, subject attendance standing, weekly timetable, and semester progress.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenAttendanceModal()}
                className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-4 py-2.5 text-xs font-bold text-[var(--cm-text)] hover:border-[var(--cm-accent)] transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={15} /> Add Subject
              </button>
              <button
                onClick={() => handleOpenTimetableModal()}
                className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-4 py-2.5 text-xs font-bold text-[var(--cm-text)] hover:border-[var(--cm-accent)] transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={15} /> Add Class
              </button>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="workspace-primary-button cursor-pointer"
              >
                <Plus size={16} /> Add Task
              </button>
            </div>
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
                Academic Target
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Pending Submissions
              </span>
              <p className="font-['Poppins'] text-2xl font-extrabold text-[var(--cm-text)] mt-1">
                {pendingCount} Tasks
              </p>
              <span className="text-[10px] font-semibold text-[var(--cm-muted)]">
                {pendingCount === 0 ? 'All caught up' : 'Due for submission'}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Attendance Standing
              </span>
              <p
                className={`font-['Poppins'] text-2xl font-extrabold mt-1 ${
                  totalConducted === 0
                    ? 'text-[var(--cm-muted)]'
                    : overallAttendanceRate >= 75
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {totalConducted === 0 ? '--%' : `${overallAttendanceRate}%`}
              </p>
              <span className="text-[10px] font-semibold text-[var(--cm-muted)]">
                {totalConducted === 0
                  ? 'Threshold: ≥ 75%'
                  : overallAttendanceRate >= 75
                  ? `✓ Exam Safe (${totalAttended}/${totalConducted})`
                  : `⚠️ Shortage Risk (${totalAttended}/${totalConducted})`}
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
        {/* Error notification if any */}
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 shadow-xs">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── 2. SUBJECT-WISE EDITABLE ATTENDANCE TRACKER ── */}
        <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 sm:p-8 shadow-xs">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--cm-accent)]">
                <TrendingUp size={13} /> Academic Safeguard
              </div>
              <h2 className="font-['Poppins'] text-xl sm:text-2xl font-extrabold text-[var(--cm-text)]">
                Subject-Wise Attendance Tracker 📊
              </h2>
              <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
                Log attended and conducted lectures to safeguard your minimum 75% university requirement.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAttendanceModal()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--cm-accent)] px-4 py-2.5 text-xs font-bold text-[var(--cm-accent-text)] hover:opacity-90 transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus size={15} /> Add Subject
            </button>
          </div>

          {/* Database Setup Notice if table does not exist */}
          {attendanceDbNotice && (
            <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 shadow-xs">
              <AlertTriangle size={17} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold">Database Setup Notice</p>
                <p className="mt-0.5 text-[11px] font-medium leading-relaxed">{attendanceDbNotice}</p>
              </div>
            </div>
          )}

          {/* Aggregate Attendance Banner */}
          {attendance.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl font-['Poppins'] font-extrabold text-sm ${
                    overallAttendanceRate >= 75
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {overallAttendanceRate}%
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--cm-text)]">
                    Overall Semester Standing: {overallAttendanceRate >= 75 ? 'Safe for Final Exams' : 'Attendance Shortage Alert'}
                  </h4>
                  <p className="text-[11px] text-[var(--cm-muted)]">
                    Total: {totalAttended} attended out of {totalConducted} classes conducted across {attendance.length} subjects
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-48">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--cm-secondary)]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      overallAttendanceRate >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, overallAttendanceRate)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Subjects List */}
          {attendanceLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-xs font-semibold text-[var(--cm-muted)]">
              <Loader2 size={16} className="animate-spin text-[var(--cm-accent)]" />
              Loading your subjects from database...
            </div>
          ) : attendance.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No subjects added yet"
              description="Add your course subjects to track conducted vs attended lectures and avoid exam debars."
              action={{
                label: 'Add First Subject',
                onClick: () => handleOpenAttendanceModal(),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attendance.map((item) => {
                const total = Number(item.total_classes) || 0
                const attended = Number(item.attended_classes) || 0
                const rate = total > 0 ? Math.round((attended / total) * 100) : 0
                const isSafe = rate >= 75

                // Safe margin calculation
                let advice = ''
                if (total === 0) {
                  advice = 'No classes conducted yet'
                } else if (isSafe) {
                  const canBunk = Math.floor(attended / 0.75 - total)
                  advice = canBunk > 0 ? `Can miss ${canBunk} class${canBunk > 1 ? 'es' : ''} safely` : 'On the threshold (cannot miss)'
                } else {
                  const needAttend = Math.max(1, Math.ceil((0.75 * total - attended) / 0.25))
                  advice = `Must attend next ${needAttend} class${needAttend > 1 ? 'es' : ''}`
                }

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 shadow-2xs hover:border-[var(--cm-accent)]/50 transition group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-['Poppins'] font-bold text-sm text-[var(--cm-text)] line-clamp-1">
                          {item.subject}
                        </h3>
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => handleOpenAttendanceModal(item)}
                            className="p-1 rounded text-[var(--cm-muted)] hover:text-[var(--cm-accent)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
                            title="Edit numbers"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttendance(item.id)}
                            className="p-1 rounded text-[var(--cm-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete subject"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between mb-2">
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={`font-['Poppins'] text-2xl font-extrabold ${
                              total === 0 ? 'text-[var(--cm-muted)]' : isSafe ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {total === 0 ? '0%' : `${rate}%`}
                          </span>
                          <span className="text-xs text-[var(--cm-muted)] font-medium">
                            ({attended} / {total} classes)
                          </span>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            total === 0
                              ? 'bg-[var(--cm-secondary)] text-[var(--cm-muted)]'
                              : isSafe
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {total === 0 ? 'New' : isSafe ? 'Safe' : 'Shortage'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--cm-secondary)] mb-2">
                        <div
                          className={`h-full transition-all duration-300 ${
                            total === 0 ? 'bg-transparent' : isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, rate)}%` }}
                        />
                      </div>

                      <p className="text-[10px] font-semibold text-[var(--cm-muted)]">
                        {advice}
                      </p>
                    </div>

                    {/* Quick increment buttons */}
                    <div className="mt-4 pt-3 border-t border-[var(--cm-border)]/70 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickLog(item.id, 'attended')}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 py-1.5 text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                        title="Mark +1 Attended Class"
                      >
                        <Check size={12} /> +1 Attended
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickLog(item.id, 'missed')}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 py-1.5 text-[11px] font-bold hover:bg-rose-100 transition cursor-pointer"
                        title="Mark +1 Missed Class"
                      >
                        <AlertTriangle size={12} /> +1 Missed
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 3. INTERACTIVE TIMETABLE & DAY SELECTOR ── */}
        <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 sm:p-8 shadow-xs">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--cm-accent)]">
                <Clock size={13} /> Weekly Agenda
              </div>
              <h2 className="font-['Poppins'] text-xl sm:text-2xl font-extrabold text-[var(--cm-text)]">
                Class, Practical & Tutorial Timetable 📅
              </h2>
              <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
                Select any weekday to view, add, or manage your scheduled lectures and venues.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenTimetableModal()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--cm-accent)] px-4 py-2.5 text-xs font-bold text-[var(--cm-accent-text)] hover:opacity-90 transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus size={15} /> Add Class
            </button>
          </div>

          {/* Database Setup Notice if table does not exist */}
          {timetableDbNotice && (
            <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 shadow-xs">
              <AlertTriangle size={17} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold">Database Setup Notice</p>
                <p className="mt-0.5 text-[11px] font-medium leading-relaxed">{timetableDbNotice}</p>
              </div>
            </div>
          )}

          {/* Week Days Strip */}
          <div className="grid grid-cols-7 gap-2 pb-6 border-b border-[var(--cm-border)]/70">
            {DAYS_OF_WEEK.map((item) => {
              const isSelected = selectedDay === item.day
              const isToday = item.day === todayShort
              const classCount = timetable.filter((t) => t.day === item.day).length

              return (
                <button
                  key={item.day}
                  type="button"
                  onClick={() => setSelectedDay(item.day)}
                  className={`flex flex-col items-center justify-center rounded-2xl py-3 px-1 text-center transition cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-md font-bold'
                      : 'border border-[var(--cm-border)]/70 bg-[var(--cm-bg)] text-[var(--cm-muted)] hover:border-[var(--cm-accent)]/60'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider">{item.day}</span>
                  <span className="font-['Poppins'] text-sm sm:text-base font-bold leading-tight mt-0.5">
                    {classCount} {classCount === 1 ? 'class' : 'classes'}
                  </span>
                  {isToday && (
                    <span
                      className={`mt-1 text-[8px] font-bold uppercase px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-[var(--cm-accent-text)]/20 text-[var(--cm-accent-text)]'
                          : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      Today
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected Day Schedule */}
          <div className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--cm-muted)]">
                Schedule for {DAYS_OF_WEEK.find((d) => d.day === selectedDay)?.label}:
              </h3>
              <span className="text-xs font-semibold text-[var(--cm-muted)]">
                {dayClasses.length} {dayClasses.length === 1 ? 'Lecture' : 'Lectures'} Scheduled
              </span>
            </div>

            {timetableLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-xs font-semibold text-[var(--cm-muted)]">
                <Loader2 size={16} className="animate-spin text-[var(--cm-accent)]" />
                Loading schedule...
              </div>
            ) : dayClasses.length === 0 ? (
              <div className="py-10 text-center rounded-2xl border border-dashed border-[var(--cm-border)] bg-[var(--cm-bg)]/40 p-8">
                <p className="text-xs font-bold text-[var(--cm-text)]">
                  No lectures scheduled for {DAYS_OF_WEEK.find((d) => d.day === selectedDay)?.label}.
                </p>
                <p className="text-[11px] text-[var(--cm-muted)] mt-1">
                  Enjoy your free time, or add classes to keep your weekly routine organized.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenTimetableModal()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--cm-accent)] px-4 py-2 text-xs font-bold text-[var(--cm-accent-text)] hover:opacity-90 transition cursor-pointer"
                >
                  <Plus size={14} /> Add Class for {selectedDay}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {dayClasses.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-4 shadow-2xs hover:border-[var(--cm-accent)]/50 transition group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="font-mono text-xs font-bold text-[var(--cm-text)] flex items-center gap-1">
                          <Clock size={12} className="text-[var(--cm-muted)]" />
                          {formatTime12(item.start_time)} – {formatTime12(item.end_time)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              item.class_type === 'Lab'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                : item.class_type === 'Tutorial'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-[var(--cm-secondary)] text-[var(--cm-muted)]'
                            }`}
                          >
                            {item.class_type}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenTimetableModal(item)}
                            className="p-1 rounded text-[var(--cm-muted)] hover:text-[var(--cm-accent)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
                            title="Edit Class"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTimetable(item.id)}
                            className="p-1 rounded text-[var(--cm-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Class"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-semibold text-sm text-[var(--cm-text)] line-clamp-1">
                        {item.subject}
                      </h4>

                      <div className="mt-2 space-y-1 text-xs text-[var(--cm-muted)]">
                        {item.room && (
                          <p className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-[var(--cm-accent)] shrink-0" />
                            {item.room}
                          </p>
                        )}
                        {item.instructor && (
                          <p className="flex items-center gap-1.5">
                            <User size={12} className="text-[var(--cm-muted)] shrink-0" />
                            {item.instructor}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 4. ACADEMIC SPRINT & SUBMISSIONS TABLE ── */}
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
                  type="button"
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

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-xs font-semibold text-[var(--cm-muted)]">
              <Loader2 size={18} className="animate-spin text-[var(--cm-accent)]" />
              Loading your assignments from database...
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={tasks.length === 0 ? 'No tasks or assignments yet' : 'No tasks match this filter'}
              description={
                tasks.length === 0
                  ? 'Stay ahead of your coursework. Add your first assignment, lab evaluation, or study goal above.'
                  : 'You have completed all assignments in this view. Use "Add Academic Task" to schedule a new one.'
              }
              action={
                tasks.length === 0
                  ? {
                      label: 'Add Your First Task',
                      onClick: () => setIsTaskModalOpen(true),
                    }
                  : undefined
              }
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
                          type="button"
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

      {/* ── ADD / EDIT TASK MODAL ── */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Add Academic Assignment">
        <form onSubmit={handleAddTask} className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Assignment Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Implement AVL Tree in C++"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Course / Subject</label>
            <input
              type="text"
              placeholder="e.g. Data Structures & Algorithms"
              value={taskForm.subject}
              onChange={(e) => setTaskForm({ ...taskForm, subject: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Priority Level</label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
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
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--cm-border)]">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(false)}
              disabled={submittingTask}
              className="rounded-xl border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingTask}
              className="workspace-primary-button disabled:opacity-50 cursor-pointer"
            >
              {submittingTask ? 'Adding...' : 'Add to Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── ADD / EDIT ATTENDANCE MODAL ── */}
      <Modal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        title={editingAttendanceId ? 'Edit Subject Attendance' : 'Add Subject to Attendance Tracker'}
      >
        <form onSubmit={handleSaveAttendance} className="space-y-4">
          {attendanceError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {attendanceError}
            </div>
          )}

          <div>
            <label className={LABEL_CLASS}>Subject / Course Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Operating Systems"
              value={attendanceForm.subject}
              onChange={(e) => setAttendanceForm({ ...attendanceForm, subject: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Total Classes Conducted</label>
              <input
                type="number"
                min="0"
                required
                value={attendanceForm.total_classes}
                onChange={(e) =>
                  setAttendanceForm({
                    ...attendanceForm,
                    total_classes: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Classes Attended</label>
              <input
                type="number"
                min="0"
                max={attendanceForm.total_classes}
                required
                value={attendanceForm.attended_classes}
                onChange={(e) =>
                  setAttendanceForm({
                    ...attendanceForm,
                    attended_classes: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3 text-xs">
            <span className="text-[var(--cm-muted)] font-medium">Calculated Percentage: </span>
            <span className="font-['Poppins'] font-bold text-[var(--cm-text)]">
              {attendanceForm.total_classes > 0
                ? `${Math.round((attendanceForm.attended_classes / attendanceForm.total_classes) * 100)}%`
                : '0%'}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--cm-border)]">
            <button
              type="button"
              onClick={() => setIsAttendanceModalOpen(false)}
              disabled={submittingAttendance}
              className="rounded-xl border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingAttendance}
              className="workspace-primary-button disabled:opacity-50 cursor-pointer"
            >
              {submittingAttendance ? 'Saving...' : editingAttendanceId ? 'Update Attendance' : 'Add Subject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── ADD / EDIT TIMETABLE MODAL ── */}
      <Modal
        isOpen={isTimetableModalOpen}
        onClose={() => setIsTimetableModalOpen(false)}
        title={editingTimetableId ? 'Edit Timetable Entry' : 'Add Class to Timetable'}
      >
        <form onSubmit={handleSaveTimetable} className="space-y-4">
          {timetableError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {timetableError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Day of Week</label>
              <select
                value={timetableForm.day}
                onChange={(e) => setTimetableForm({ ...timetableForm, day: e.target.value })}
                className={INPUT_CLASS}
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.day} value={d.day}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Class Type</label>
              <select
                value={timetableForm.class_type}
                onChange={(e) => setTimetableForm({ ...timetableForm, class_type: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="Class">Lecture / Class</option>
                <option value="Lab">Practical / Lab</option>
                <option value="Tutorial">Tutorial</option>
                <option value="Seminar">Seminar</option>
                <option value="Activity">Activity</option>
                <option value="Self Study">Self Study</option>
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Course / Subject Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Design & Analysis of Algorithms"
              value={timetableForm.subject}
              onChange={(e) => setTimetableForm({ ...timetableForm, subject: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Start Time</label>
              <input
                type="time"
                required
                value={timetableForm.start_time}
                onChange={(e) => setTimetableForm({ ...timetableForm, start_time: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>End Time</label>
              <input
                type="time"
                required
                value={timetableForm.end_time}
                onChange={(e) => setTimetableForm({ ...timetableForm, end_time: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Room / Hall (Optional)</label>
              <input
                type="text"
                placeholder="e.g. LT-301 / Lab 3"
                value={timetableForm.room}
                onChange={(e) => setTimetableForm({ ...timetableForm, room: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Instructor / Faculty (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Dr. Mukherjee"
                value={timetableForm.instructor}
                onChange={(e) => setTimetableForm({ ...timetableForm, instructor: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--cm-border)]">
            <button
              type="button"
              onClick={() => setIsTimetableModalOpen(false)}
              disabled={submittingTimetable}
              className="rounded-xl border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingTimetable}
              className="workspace-primary-button disabled:opacity-50 cursor-pointer"
            >
              {submittingTimetable ? 'Saving...' : editingTimetableId ? 'Update Class' : 'Add to Schedule'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Planner
