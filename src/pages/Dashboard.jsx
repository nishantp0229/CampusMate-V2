// src/pages/Dashboard.jsx — Thoughtfully designed student workspace

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  MapPin,
  Clock,
  Plus,
  ExternalLink,
  CheckCircle2,
  Circle,
  Compass,
  ArrowRight,
} from 'lucide-react'
import { priorityBadge } from '../components/ui/Badge'
import {
  MOCK_TASKS,
  MOCK_EVENTS,
  MOCK_LOST_FOUND,
  MOCK_RESOURCES,
  MOCK_USER,
} from '../utils/mockData'

function Dashboard() {
  // Local state so students can toggle task completion directly on the dashboard
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [events, setEvents] = useState(MOCK_EVENTS)

  const toggleTaskStatus = (id) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' }
          : t
      )
    )
  }

  const toggleEventRsvp = (id) => {
    setEvents(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              isRegistered: !e.isRegistered,
              attendees: e.isRegistered ? e.attendees - 1 : e.attendees + 1,
            }
          : e
      )
    )
  }

  // Derived academic stats
  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  const urgentTasks = [...pendingTasks]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 4)

  const upcomingEvents = [...events]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3)

  const recentResources = [...MOCK_RESOURCES].slice(0, 3)
  const recentLostFound = [...MOCK_LOST_FOUND].slice(0, 3)

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-7">

      {/* ── 1. Editorial Student Briefing Header ── */}
      <div className="border-b border-slate-200/80 dark:border-white/[0.08] pb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              <span>DTU CSE</span>
              <span>·</span>
              <span>FALL SEMESTER '26</span>
              <span>·</span>
              <span className="text-[#5B8DEF] dark:text-[#94B8FF] font-medium">WEEK 11</span>
            </div>

            <h1
              className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Good morning, {MOCK_USER.name}
            </h1>

            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              You have <strong className="text-slate-900 dark:text-slate-200 font-medium">{pendingTasks.length} pending academic tasks</strong> and{' '}
              <strong className="text-slate-900 dark:text-slate-200 font-medium">1 campus workshop</strong> coming up this week.
            </p>
          </div>

          {/* Quick-action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              to="/planner"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium rounded-lg transition-colors shadow-xs"
            >
              <Plus size={14} />
              New Assignment
            </Link>
            <Link
              to="/resources"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-[#181D2B] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/10 transition-colors"
            >
              <BookOpen size={14} />
              Course Notes
            </Link>
          </div>
        </div>

        {/* Dense Academic Metric Strip (replaces the 4 chunky cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Pending Tasks
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-semibold text-slate-900 dark:text-slate-100 font-mono">
                {pendingTasks.length}
              </span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                {pendingTasks.filter(t => t.priority === 'high').length} urgent
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Completed Tasks
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                {completedTasks.length}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                this semester
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Campus Events
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-semibold text-slate-900 dark:text-slate-100 font-mono">
                {events.length}
              </span>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                {events.filter(e => e.isRegistered).length} attending
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Shared Notes
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-semibold text-slate-900 dark:text-slate-100 font-mono">
                {MOCK_RESOURCES.length}
              </span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                Sem 5 ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Two-Column Asymmetric Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">

        {/* ── Left Column: Academic Command Center (7 of 12 cols) ── */}
        <div className="lg:col-span-7 space-y-7">

          {/* Section: Priority Assignment Ledger */}
          <div className="bg-white dark:bg-[#151926] rounded-xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <h2
                  className="font-semibold text-sm text-slate-900 dark:text-slate-100"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Immediate Academic Deadlines
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sorted by submission due dates
                </p>
              </div>
              <Link
                to="/planner"
                className="text-xs font-medium text-[#5B8DEF] hover:underline flex items-center gap-1"
              >
                Open Planner <ArrowRight size={12} />
              </Link>
            </div>

            {/* Task rows formatted like a structured task ledger */}
            <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {urgentTasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  🎉 No pending assignments! You're completely caught up.
                </div>
              ) : (
                urgentTasks.map((task) => {
                  const p = priorityBadge(task.priority)
                  const isDone = task.status === 'completed'

                  return (
                    <div
                      key={task.id}
                      className="px-4 py-3.5 flex items-start gap-3 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Direct toggle button */}
                      <button
                        onClick={() => toggleTaskStatus(task.id)}
                        className="mt-0.5 text-slate-400 hover:text-[#5B8DEF] dark:text-slate-500 transition-colors flex-shrink-0"
                        title={isDone ? 'Mark as pending' : 'Mark as done'}
                      >
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        ) : (
                          <Circle size={16} />
                        )}
                      </button>

                      {/* Task details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p
                            className={`text-xs font-medium truncate ${
                              isDone
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {task.title}
                          </p>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0">
                            <Clock size={11} /> {formatDate(task.dueDate)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                            {task.subject}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              task.priority === 'high'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                : task.priority === 'medium'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                            }`}
                          >
                            {p.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
              <span>{pendingTasks.length} total tasks remaining</span>
              <Link to="/planner" className="hover:text-slate-800 dark:hover:text-slate-200">
                Manage all tasks →
              </Link>
            </div>
          </div>

          {/* Section: Recommended Study Resources (NoteNest Library) */}
          <div className="bg-white dark:bg-[#151926] rounded-xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="font-semibold text-sm text-slate-900 dark:text-slate-100"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  NoteNest — Core Semester Notes
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Curated resources shared for Semester 5
                </p>
              </div>
              <Link
                to="/resources"
                className="text-xs font-medium text-[#5B8DEF] hover:underline flex items-center gap-1"
              >
                Browse Library <ArrowRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recentResources.map((res) => {
                return (
                  <div
                    key={res.id}
                    className="p-3 rounded-lg border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 uppercase">
                          {res.resourceType}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Sem {res.semester}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-[#5B8DEF] transition-colors line-clamp-1">
                        {res.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {res.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 truncate max-w-[100px]">
                        {res.subject}
                      </span>
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-medium text-[#5B8DEF] hover:underline inline-flex items-center gap-0.5"
                      >
                        Open <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Right Column: Campus Beat & Timeline (5 of 12 cols) ── */}
        <div className="lg:col-span-5 space-y-6">

          {/* Widget 1: CampusConnect Events Schedule */}
          <div className="bg-white dark:bg-[#151926] rounded-xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="font-semibold text-sm text-slate-900 dark:text-slate-100"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Campus Life & Events
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Upcoming hackathons & fests at DTU
                </p>
              </div>
              <Link
                to="/events"
                className="text-xs font-medium text-[#5B8DEF] hover:underline"
              >
                All events →
              </Link>
            </div>

            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const dateObj = new Date(event.date)
                const month = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                const day = dateObj.getDate()

                return (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border border-slate-100 dark:border-white/[0.06] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors flex items-start gap-3"
                  >
                    {/* Compact Date Box */}
                    <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08] flex flex-col items-center justify-center flex-shrink-0 text-slate-700 dark:text-slate-300">
                      <span className="text-[9px] font-mono font-bold tracking-tight text-slate-500 dark:text-slate-400 leading-none">
                        {month}
                      </span>
                      <span className="text-sm font-semibold font-mono leading-none mt-0.5">
                        {day}
                      </span>
                    </div>

                    {/* Event details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-medium text-[#5B8DEF] dark:text-[#94B8FF] uppercase tracking-wide">
                          {event.category}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {event.attendees} going
                        </span>
                      </div>

                      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {event.title}
                      </h3>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {event.location}
                      </p>
                    </div>

                    {/* RSVP toggle */}
                    <button
                      onClick={() => toggleEventRsvp(event.id)}
                      className={`text-[11px] font-medium px-2 py-1 rounded-md transition-colors flex-shrink-0 ${
                        event.isRegistered
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {event.isRegistered ? 'RSVP’d' : 'RSVP'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Widget 2: CampusFind Lost & Found Bulletin */}
          <div className="bg-white dark:bg-[#151926] rounded-xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Compass size={15} className="text-slate-500" />
                <h2
                  className="font-semibold text-sm text-slate-900 dark:text-slate-100"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  CampusFind Bulletin
                </h2>
              </div>
              <Link
                to="/lost-found"
                className="text-xs font-medium text-[#5B8DEF] hover:underline"
              >
                Board →
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {recentLostFound.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-mono font-medium px-1.5 py-0.2 rounded uppercase ${
                          item.type === 'lost'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {item.type}
                      </span>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.itemName}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      📍 {item.location}
                    </p>
                  </div>

                  <Link
                    to="/lost-found"
                    className="text-[11px] font-medium text-[#5B8DEF] hover:underline flex-shrink-0"
                  >
                    Details
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Widget 3: Academic Term Timeline Progress */}
          <div className="p-4 rounded-xl bg-slate-100/60 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] text-xs">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium mb-1.5">
              <span>Semester 5 Progress</span>
              <span className="font-mono text-slate-900 dark:text-slate-100">68%</span>
            </div>
            {/* Clean Progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#94B8FF] to-[#C2B0FF]"
                style={{ width: '68%' }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              <span>Midterms Completed</span>
              <span>Finals in ~4 weeks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
