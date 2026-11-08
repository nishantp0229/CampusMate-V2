// src/pages/Dashboard.jsx — Student home dashboard

import { Link } from 'react-router-dom'
import {
  CheckSquare, CalendarDays, BookOpen, MapPin,
  TrendingUp, Clock, ChevronRight, Plus, ExternalLink
} from 'lucide-react'
import Badge, { priorityBadge, categoryBadge, typeBadge, resourceTypeBadge } from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import {
  MOCK_TASKS, MOCK_EVENTS, MOCK_LOST_FOUND,
  MOCK_RESOURCES, MOCK_USER
} from '../utils/mockData'

function Dashboard() {
  // Pending tasks (top 4, sorted by due date)
  const pendingTasks = MOCK_TASKS
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 4)

  const completedCount = MOCK_TASKS.filter(t => t.status === 'completed').length
  const pendingCount = MOCK_TASKS.filter(t => t.status === 'pending').length

  // Upcoming events (top 3)
  const upcomingEvents = [...MOCK_EVENTS]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3)

  // Recent resources (top 3)
  const recentResources = [...MOCK_RESOURCES].slice(0, 3)

  // Recent lost/found (top 3)
  const recentLostFound = [...MOCK_LOST_FOUND].slice(0, 3)

  // Greeting based on current hour
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

      {/* ══ WELCOME BANNER ══════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-[#EAF2FF] via-[#F0EBFF] to-[#EAF2FF] dark:from-[#1E2538] dark:via-[#221E38] dark:to-[#1E2538] rounded-2xl p-6 border border-[#E2E8F0] dark:border-white/[0.07] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2
            className="text-xl sm:text-2xl font-bold text-[#242B3A] dark:text-[#F1F1FC]"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {greeting}, {MOCK_USER.name}! 👋
          </h2>
          <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] mt-1">
            {MOCK_USER.college} · {MOCK_USER.department} (Sem {MOCK_USER.semester})
          </p>
        </div>
        <Link
          to="/planner"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#A9C9FF] text-white text-sm font-medium rounded-xl hover:bg-[#8BB8F8] transition-colors shadow-sm flex-shrink-0"
        >
          <Plus size={16} />
          Add Task
        </Link>
      </div>

      {/* ══ STATS ROW ════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Tasks', value: pendingCount, icon: CheckSquare, color: '#5B9BF8', bg: '#EAF2FF', link: '/planner' },
          { label: 'Tasks Done', value: completedCount, icon: TrendingUp, color: '#6BCB9A', bg: '#E8F8F0', link: '/planner' },
          { label: 'Upcoming Events', value: MOCK_EVENTS.length, icon: CalendarDays, color: '#9B7FE8', bg: '#F0EBFF', link: '/events' },
          { label: 'Study Resources', value: MOCK_RESOURCES.length, icon: BookOpen, color: '#FFB347', bg: '#FFF6E9', link: '/resources' },
        ].map(({ label, value, icon: Icon, color, bg, link }) => (
          <Link
            key={label}
            to={link}
            className="bg-white dark:bg-[#252A3C] rounded-2xl p-4 border border-[#E2E8F0] dark:border-white/[0.07] shadow-sm hover:shadow-md transition-shadow flex items-center gap-4"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: bg }}
            >
              <Icon size={22} style={{ color }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#242B3A] dark:text-[#F1F1FC]"
                style={{ fontFamily: 'Poppins, sans-serif' }}>
                {value}
              </p>
              <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] mt-0.5">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ══ ROW 1: ASSIGNMENTS + EVENTS ═════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming Assignments */}
        <div className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckSquare size={18} className="text-[#5B9BF8]" />
              <h3 className="font-semibold text-base text-[#242B3A] dark:text-[#F1F1FC]"
                style={{ fontFamily: 'Poppins, sans-serif' }}>
                Pending Assignments
              </h3>
            </div>
            <Link to="/planner" className="text-xs text-[#5B9BF8] hover:underline flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-2.5 flex-1">
            {pendingTasks.length === 0 ? (
              <EmptyState icon={CheckSquare} title="All caught up!" description="No pending tasks right now." />
            ) : (
              pendingTasks.map(task => {
                const p = priorityBadge(task.priority)
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl border border-[#E2E8F0] dark:border-white/[0.05] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#242B3A] dark:text-[#F1F1FC] truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] mt-0.5">
                        {task.subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={p.variant}>{p.label}</Badge>
                      <span className="text-xs text-[#737B8C] dark:text-[#A0A8B8] flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-[#9B7FE8]" />
              <h3 className="font-semibold text-base text-[#242B3A] dark:text-[#F1F1FC]"
                style={{ fontFamily: 'Poppins, sans-serif' }}>
                Upcoming Events
              </h3>
            </div>
            <Link to="/events" className="text-xs text-[#5B9BF8] hover:underline flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-2.5 flex-1">
            {upcomingEvents.map(event => {
              const cat = categoryBadge(event.category)
              return (
                <div
                  key={event.id}
                  className="p-3 rounded-xl border border-[#E2E8F0] dark:border-white/[0.05] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-[#242B3A] dark:text-[#F1F1FC] truncate">
                      {event.title}
                    </p>
                    <Badge variant={cat.variant}>{cat.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#737B8C] dark:text-[#A0A8B8]">
                    <span>{formatDate(event.date)}</span>
                    <span className="flex items-center gap-1 truncate">
                      <MapPin size={11} /> {event.location}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══ ROW 2: RESOURCES + LOST & FOUND ═════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Recent Resources (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-[#FFB347]" />
              <h3 className="font-semibold text-base text-[#242B3A] dark:text-[#F1F1FC]"
                style={{ fontFamily: 'Poppins, sans-serif' }}>
                Recently Added Resources
              </h3>
            </div>
            <Link to="/resources" className="text-xs text-[#5B9BF8] hover:underline flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentResources.map(res => {
              const tb = resourceTypeBadge(res.resourceType)
              return (
                <div
                  key={res.id}
                  className="p-3 rounded-xl border border-[#E2E8F0] dark:border-white/[0.05] flex items-center justify-between gap-3 hover:bg-[#F7F8FC] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#242B3A] dark:text-[#F1F1FC] truncate">
                      {res.title}
                    </p>
                    <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] mt-0.5">
                      {res.subject} · Sem {res.semester}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={tb.variant}>{tb.label}</Badge>
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-[#737B8C] hover:text-[#5B9BF8] transition-colors"
                      aria-label="Open resource"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Lost & Found (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-[#FF9BAA]" />
              <h3 className="font-semibold text-base text-[#242B3A] dark:text-[#F1F1FC]"
                style={{ fontFamily: 'Poppins, sans-serif' }}>
                CampusFind
              </h3>
            </div>
            <Link to="/lost-found" className="text-xs text-[#5B9BF8] hover:underline flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentLostFound.map(item => {
              const tb = typeBadge(item.type)
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-[#E2E8F0] dark:border-white/[0.05] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-[#242B3A] dark:text-[#F1F1FC] truncate">
                      {item.itemName}
                    </p>
                    <Badge variant={tb.variant}>{tb.label}</Badge>
                  </div>
                  <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] truncate">
                    📍 {item.location}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
