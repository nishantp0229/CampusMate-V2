// src/pages/TeamUp.jsx — Student Teammate-Finding System for Hackathons, Projects & Competitions

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users,
  Plus,
  Search,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Award,
  Code2,
  FolderGit2,
  Layers,
  UserPlus,
  X,
  Edit2,
  Trash2,
  Check,
  RefreshCw,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  PROJECT_TYPES,
  filterTeams,
  getTeamCapacityMetrics,
  getTeamStatusBadge,
  validateTeamForm,
  validateJoinRequest,
  formatTeamDate,
} from '../lib/teamup'

const PROJECT_TYPE_CONFIG = {
  Hackathon: {
    icon: Code2,
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  },
  Project: {
    icon: FolderGit2,
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  Competition: {
    icon: Award,
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  Other: {
    icon: Layers,
    badgeClass: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
  },
}

const inputCls =
  'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-sm text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-accent)] focus:outline-none transition'
const labelCls = 'mb-1 block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider'

// ─── SUBCOMPONENT: TEAM CARD ──────────────────────────────────────────────────
function TeamCard({ team, onSelect, onApply, isLeader, isMember, hasPendingRequest }) {
  const badge = getTeamStatusBadge(team.status, team.deadline)
  const typeConfig = PROJECT_TYPE_CONFIG[team.project_type] || PROJECT_TYPE_CONFIG.Other
  const TypeIcon = typeConfig.icon
  const capacity = getTeamCapacityMetrics(team.members.length, team.max_members)

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5 transition hover:shadow-md">
      {/* Header: Project type & Recruitment status */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${typeConfig.badgeClass}`}>
          <TypeIcon size={12} />
          <span>{team.project_type}</span>
        </span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.badgeClass}`}>
          {badge.label}
        </span>
      </div>

      {/* Title & Description */}
      <h3 className="text-base font-bold text-[var(--cm-text)] line-clamp-1 mb-1.5" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {team.title}
      </h3>
      <p className="text-xs text-[var(--cm-muted)] line-clamp-3 mb-4 leading-relaxed flex-1">
        {team.description}
      </p>

      {/* Skills */}
      {Array.isArray(team.skills) && team.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {team.skills.slice(0, 4).map((skill, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--cm-secondary)] text-[var(--cm-text)] border border-[var(--cm-border)]"
            >
              {skill}
            </span>
          ))}
          {team.skills.length > 4 && (
            <span className="px-1.5 py-0.5 rounded-md text-[11px] text-[var(--cm-muted)]">
              +{team.skills.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Capacity Progress Bar */}
      <div className="space-y-1.5 mb-4 pt-2 border-t border-[var(--cm-border)]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--cm-muted)] font-medium">Team Capacity</span>
          <span className="font-semibold text-[var(--cm-text)]">
            {capacity.formatted} ({capacity.spotsLeft} spots left)
          </span>
        </div>
        <div className="w-full bg-[var(--cm-secondary)] rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${capacity.isFull ? 'bg-purple-500' : 'bg-[var(--cm-accent)]'}`}
            style={{ width: `${capacity.percentage}%` }}
          />
        </div>
      </div>

      {/* Footer: Leader & Deadline */}
      <div className="flex items-center justify-between text-xs text-[var(--cm-muted)] pt-3 border-t border-[var(--cm-border)] mb-4">
        <div className="flex items-center gap-1.5 truncate max-w-[55%]">
          <div className="w-5 h-5 rounded-full bg-[var(--cm-secondary)] text-[var(--cm-text)] border border-[var(--cm-border)] flex items-center justify-center text-[10px] font-bold shrink-0">
            {team.creator?.full_name?.charAt(0) || 'L'}
          </div>
          <span className="truncate">{team.creator?.full_name || 'Leader'}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0" title="Recruitment deadline">
          <Clock size={12} />
          <span>{formatTeamDate(team.deadline)}</span>
        </div>
      </div>

      {/* Card Actions */}
      <div className="flex items-center gap-2 mt-auto">
        <button
          type="button"
          onClick={() => onSelect(team)}
          className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition text-center"
        >
          View Details
        </button>

        {isLeader ? (
          <span className="px-3 py-2 text-xs font-semibold rounded-xl bg-[var(--cm-secondary)] text-[var(--cm-text)]">
            Your Team
          </span>
        ) : isMember ? (
          <span className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Member
          </span>
        ) : hasPendingRequest ? (
          <span className="px-3 py-2 text-xs font-semibold rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Applied
          </span>
        ) : badge.canApply ? (
          <button
            type="button"
            onClick={() => onApply(team)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-[var(--cm-accent)] text-[var(--cm-accent-text)] hover:opacity-90 transition"
          >
            Apply
          </button>
        ) : (
          <span className="px-3 py-2 text-xs font-medium rounded-xl text-[var(--cm-muted)] bg-[var(--cm-secondary)] opacity-60">
            {badge.label}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── SUBCOMPONENT: DETAILS MODAL ──────────────────────────────────────────────
function TeamDetailsModal({
  team,
  onClose,
  onEdit,
  onApply,
  onToggleRecruitment,
  onRemoveMember,
  onLeaveTeam,
  isLeader,
  isMember,
  hasPendingRequest,
}) {
  if (!team) return null

  const badge = getTeamStatusBadge(team.status, team.deadline)
  const typeConfig = PROJECT_TYPE_CONFIG[team.project_type] || PROJECT_TYPE_CONFIG.Other
  const TypeIcon = typeConfig.icon
  const capacity = getTeamCapacityMetrics(team.members.length, team.max_members)

  return (
    <Modal isOpen={Boolean(team)} onClose={onClose} title={team.title} size="lg">
      <div className="space-y-6">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${typeConfig.badgeClass}`}>
            <TypeIcon size={13} />
            <span>{team.project_type}</span>
          </span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${badge.badgeClass}`}>
            {badge.label}
          </span>
          {team.deadline && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[var(--cm-secondary)] text-[var(--cm-muted)] border border-[var(--cm-border)]">
              <Clock size={12} />
              <span>Deadline: {formatTeamDate(team.deadline)}</span>
            </span>
          )}
        </div>

        {/* Project Description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider">Project Overview</h4>
          <p className="text-sm text-[var(--cm-text)] leading-relaxed whitespace-pre-wrap">{team.description}</p>
        </div>

        {/* Project Link */}
        {team.project_url && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider">Repository / Project Link</h4>
            <a
              href={team.project_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--cm-accent)] hover:underline font-medium break-all"
            >
              <ExternalLink size={13} />
              <span>{team.project_url}</span>
            </a>
          </div>
        )}

        {/* Skills */}
        {Array.isArray(team.skills) && team.skills.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider">Skills & Roles Needed</h4>
            <div className="flex flex-wrap gap-2">
              {team.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--cm-secondary)] text-[var(--cm-text)] border border-[var(--cm-border)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Team Roster */}
        <div className="space-y-3 pt-3 border-t border-[var(--cm-border)]">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider">
              Team Roster ({capacity.formatted})
            </h4>
            <span className="text-xs text-[var(--cm-muted)]">{capacity.spotsLeft} spots remaining</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-secondary)]/40">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-full bg-[var(--cm-surface)] text-[var(--cm-text)] border border-[var(--cm-border)] flex items-center justify-center font-bold text-xs shrink-0">
                    {m.profile?.full_name?.charAt(0) || 'M'}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-[var(--cm-text)] truncate">{m.profile?.full_name || 'Member'}</div>
                    <div className="text-[11px] text-[var(--cm-muted)] truncate">{m.profile?.department || 'Student'}</div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {m.role === 'leader' ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[var(--cm-accent)] text-[var(--cm-accent-text)]">
                      Leader
                    </span>
                  ) : isLeader ? (
                    <button
                      type="button"
                      onClick={() => onRemoveMember(team.id, m.user_id)}
                      className="text-[11px] text-rose-500 hover:text-rose-700 font-medium"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-[var(--cm-surface)] text-[var(--cm-muted)]">
                      Member
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-4 border-t border-[var(--cm-border)] flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--cm-border)] text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
          >
            Close
          </button>

          {isLeader ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEdit(team)
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--cm-border)] bg-[var(--cm-surface)] text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition inline-flex items-center gap-1.5"
              >
                <Edit2 size={13} />
                <span>Edit Team</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleRecruitment(team)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--cm-secondary)] text-[var(--cm-text)] hover:opacity-90 transition"
              >
                {team.status === 'open' ? 'Close Recruitment' : 'Reopen Recruitment'}
              </button>
            </>
          ) : isMember ? (
            <button
              type="button"
              onClick={() => onLeaveTeam(team.id)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition"
            >
              Leave Team
            </button>
          ) : hasPendingRequest ? (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Application Pending Review</span>
          ) : badge.canApply ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onApply(team)
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--cm-accent)] text-[var(--cm-accent-text)] hover:opacity-90 transition inline-flex items-center gap-1.5"
            >
              <UserPlus size={14} />
              <span>Apply to Join Team</span>
            </button>
          ) : (
            <span className="text-xs text-[var(--cm-muted)] font-medium">Recruitment is {badge.label.toLowerCase()}</span>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── SUBCOMPONENT: CREATE / EDIT TEAM MODAL ───────────────────────────────────
function getInitialTeamFormData(team) {
  if (!team) {
    return {
      title: '',
      description: '',
      projectType: 'Hackathon',
      skills: '',
      maxMembers: 4,
      deadline: '',
      projectUrl: '',
    }
  }
  let deadlineStr = ''
  if (team.deadline) {
    try {
      deadlineStr = new Date(team.deadline).toISOString().slice(0, 16)
    } catch {
      deadlineStr = ''
    }
  }
  return {
    title: team.title || '',
    description: team.description || '',
    projectType: team.project_type || 'Hackathon',
    skills: Array.isArray(team.skills) ? team.skills.join(', ') : '',
    maxMembers: team.max_members || 4,
    deadline: deadlineStr,
    projectUrl: team.project_url || '',
  }
}

function TeamFormModal({ isOpen, onClose, teamToEdit, onSave, submitting }) {
  const [formData, setFormData] = useState(() => getInitialTeamFormData(teamToEdit))
  const [errors, setErrors] = useState({})

  const handleSubmit = (e) => {
    e.preventDefault()
    const validation = validateTeamForm(formData)
    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }
    setErrors({})
    onSave(validation.data, teamToEdit?.id)
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={teamToEdit ? 'Edit Team Details' : 'Create a New Team'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 border border-rose-200 text-xs">
            {errors.form}
          </div>
        )}

        <div>
          <label className={labelCls}>Team / Project Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Smart Campus IoT Hub"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={inputCls}
          />
          {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title}</p>}
        </div>

        <div>
          <label className={labelCls}>Project Type *</label>
          <select
            value={formData.projectType}
            onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
            className={inputCls}
          >
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Project Goals & Description *</label>
          <textarea
            required
            rows={4}
            placeholder="Describe what you plan to build, problem solved, and expected contributions..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={inputCls}
          />
          {errors.description && <p className="text-xs text-rose-500 mt-1">{errors.description}</p>}
        </div>

        <div>
          <label className={labelCls}>Required Skills * (comma-separated)</label>
          <input
            type="text"
            required
            placeholder="e.g. React, Node.js, ROS, PyTorch"
            value={formData.skills}
            onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
            className={inputCls}
          />
          {errors.skills && <p className="text-xs text-rose-500 mt-1">{errors.skills}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Max Members (2-15) *</label>
            <input
              type="number"
              min={2}
              max={15}
              required
              value={formData.maxMembers}
              onChange={(e) => setFormData({ ...formData, maxMembers: e.target.value })}
              className={inputCls}
            />
            {errors.maxMembers && <p className="text-xs text-rose-500 mt-1">{errors.maxMembers}</p>}
          </div>

          <div>
            <label className={labelCls}>Recruitment Deadline (optional)</label>
            <input
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className={inputCls}
            />
            {errors.deadline && <p className="text-xs text-rose-500 mt-1">{errors.deadline}</p>}
          </div>
        </div>

        <div>
          <label className={labelCls}>GitHub / Project Link (optional)</label>
          <input
            type="url"
            placeholder="https://github.com/campusmate/team"
            value={formData.projectUrl}
            onChange={(e) => setFormData({ ...formData, projectUrl: e.target.value })}
            className={inputCls}
          />
          {errors.projectUrl && <p className="text-xs text-rose-500 mt-1">{errors.projectUrl}</p>}
        </div>

        <div className="pt-4 border-t border-[var(--cm-border)] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--cm-border)] text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--cm-accent)] text-[var(--cm-accent-text)] hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            <span>{teamToEdit ? 'Save Changes' : 'Create Team'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── SUBCOMPONENT: APPLY MODAL ────────────────────────────────────────────────
function ApplyModal({ isOpen, onClose, team, onApply, submitting }) {
  const [formData, setFormData] = useState({ introduction: '', skills: '' })
  const [errors, setErrors] = useState({})

  const handleSubmit = (e) => {
    e.preventDefault()
    const validation = validateJoinRequest(formData)
    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }
    setErrors({})
    onApply(team.id, validation.data)
  }

  if (!isOpen || !team) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Join "${team.title}"`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-xl bg-[var(--cm-secondary)] border border-[var(--cm-border)] text-xs text-[var(--cm-muted)]">
          Looking for: <strong className="text-[var(--cm-text)]">{Array.isArray(team.skills) ? team.skills.join(', ') : 'Any skills'}</strong>
        </div>

        {errors.form && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 border border-rose-200 text-xs">
            {errors.form}
          </div>
        )}

        <div>
          <label className={labelCls}>Your Pitch & Introduction *</label>
          <textarea
            required
            rows={3}
            placeholder="Why do you want to join and what relevant experience or enthusiasm do you bring?"
            value={formData.introduction}
            onChange={(e) => setFormData({ ...formData, introduction: e.target.value })}
            className={inputCls}
          />
          {errors.introduction && <p className="text-xs text-rose-500 mt-1">{errors.introduction}</p>}
        </div>

        <div>
          <label className={labelCls}>Your Relevant Skills *</label>
          <input
            type="text"
            required
            placeholder="e.g. React, Supabase, Tailwind, Python"
            value={formData.skills}
            onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
            className={inputCls}
          />
          {errors.skills && <p className="text-xs text-rose-500 mt-1">{errors.skills}</p>}
        </div>

        <div className="pt-4 border-t border-[var(--cm-border)] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--cm-border)] text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--cm-accent)] text-[var(--cm-accent-text)] hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            <span>Send Application</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── MAIN TEAMUP PAGE ─────────────────────────────────────────────────────────
export default function TeamUp() {
  const { user } = useAuth()
  const [teams, setTeams] = useState([])
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState({})
  const [joinRequests, setJoinRequests] = useState([])

  const [loading, setLoading] = useState(true)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [feedback, setFeedback] = useState(null) // { type, text }
  const [submitting, setSubmitting] = useState(false)

  // Filters & Tabs
  const [viewTab, setViewTab] = useState('browse') // 'browse' | 'my-teams'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  // Modals state
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [editingTeam, setEditingTeam] = useState(null) // null = closed, {} = create, team = edit
  const [applyingTeam, setApplyingTeam] = useState(null) // null = closed, team = apply

  const showFeedback = useCallback((text, type = 'success') => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }, [])

  // Fetch all TeamUp data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false })

      if (teamsError) {
        if (
          teamsError.code === '42P01' ||
          teamsError.message?.includes('relation "public.teams" does not exist') ||
          teamsError.message?.includes('does not exist')
        ) {
          setMigrationRequired(true)
          setLoading(false)
          return
        }
        throw teamsError
      }

      setMigrationRequired(false)
      setTeams(teamsData || [])

      const { data: membersData, error: membersError } = await supabase.from('team_members').select('*')
      if (membersError) throw membersError
      setMembers(membersData || [])

      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, avatar_url, department, college')
      if (profilesData) {
        const profileMap = {}
        for (const p of profilesData) profileMap[p.id] = p
        setProfiles(profileMap)
      }

      const { data: reqsData } = await supabase.from('team_join_requests').select('*').order('created_at', { ascending: false })
      setJoinRequests(reqsData || [])
    } catch (err) {
      console.error('Error fetching TeamUp data:', err)
      setErrorMessage(err.message || 'Failed to load TeamUp data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Denormalized teams with leaders and confirmed members
  const enrichedTeams = useMemo(() => {
    const memberMap = {}
    for (const m of members) {
      if (!memberMap[m.team_id]) memberMap[m.team_id] = []
      memberMap[m.team_id].push({
        ...m,
        profile: profiles[m.user_id] || { full_name: 'Student', department: 'Campus' },
      })
    }

    return teams.map((team) => {
      const teamMembers = memberMap[team.id] || []
      const leaderMember = teamMembers.find((m) => m.role === 'leader')
      const creatorProfile = profiles[team.creator_id] || leaderMember?.profile || {
        full_name: 'Team Leader',
        department: 'Campus',
      }
      return {
        ...team,
        members: teamMembers,
        creator: creatorProfile,
      }
    })
  }, [teams, members, profiles])

  const selectedTeam = useMemo(
    () => (selectedTeamId ? enrichedTeams.find((t) => t.id === selectedTeamId) || null : null),
    [enrichedTeams, selectedTeamId]
  )

  const filteredTeams = useMemo(() => {
    return filterTeams(enrichedTeams, {
      search: searchQuery,
      category: selectedCategory,
      status: selectedStatus,
    })
  }, [enrichedTeams, searchQuery, selectedCategory, selectedStatus])

  const teamsLedByMe = useMemo(() => {
    if (!user) return []
    return enrichedTeams.filter((t) => t.creator_id === user.id)
  }, [enrichedTeams, user])

  const teamsJoinedByMe = useMemo(() => {
    if (!user) return []
    return enrichedTeams.filter((t) => t.creator_id !== user.id && t.members.some((m) => m.user_id === user.id))
  }, [enrichedTeams, user])

  const mySentRequests = useMemo(() => {
    if (!user) return []
    return joinRequests
      .filter((r) => r.user_id === user.id)
      .map((r) => {
        const team = teams.find((t) => t.id === r.team_id)
        return {
          ...r,
          teamTitle: team?.title || 'Unknown Team',
          projectType: team?.project_type || 'Other',
        }
      })
  }, [joinRequests, teams, user])

  const incomingRequests = useMemo(() => {
    if (!user) return []
    const myTeamIds = new Set(teamsLedByMe.map((t) => t.id))
    return joinRequests
      .filter((r) => myTeamIds.has(r.team_id) && r.status === 'pending')
      .map((r) => {
        const team = teamsLedByMe.find((t) => t.id === r.team_id)
        return {
          ...r,
          teamTitle: team?.title || 'Your Team',
          teamCapacity: team ? `${team.members.length} / ${team.max_members}` : '',
          applicant: profiles[r.user_id] || { full_name: 'Student Candidate', department: 'Campus' },
        }
      })
  }, [joinRequests, teamsLedByMe, profiles, user])

  const getUserTeamState = (team) => {
    if (!user || !team) return { isLeader: false, isMember: false, hasPendingRequest: false }
    const isLeader = team.creator_id === user.id
    const isMember = (team.members || []).some((m) => m.user_id === user.id)
    const hasPendingRequest = joinRequests.some(
      (r) => r.team_id === team.id && r.user_id === user.id && r.status === 'pending'
    )
    return { isLeader, isMember, hasPendingRequest }
  }

  // ─── ACTIONS ────────────────────────────────────────────────────────────────
  const handleSaveTeam = async (payload, editId) => {
    setSubmitting(true)
    try {
      if (editId) {
        const { error } = await supabase.rpc('teamup_update_team', {
          p_team_id: editId,
          p_title: payload.title,
          p_description: payload.description,
          p_project_type: payload.projectType,
          p_skills: payload.skills,
          p_max_members: payload.maxMembers,
          p_deadline: payload.deadline ? new Date(payload.deadline).toISOString() : null,
          p_project_url: payload.projectUrl,
        })
        if (error) throw error
        showFeedback('Team updated successfully!')
      } else {
        const { error } = await supabase.rpc('teamup_create_team', {
          p_title: payload.title,
          p_description: payload.description,
          p_project_type: payload.projectType,
          p_skills: payload.skills,
          p_max_members: payload.maxMembers,
          p_deadline: payload.deadline ? new Date(payload.deadline).toISOString() : null,
          p_project_url: payload.projectUrl,
        })
        if (error) throw error
        showFeedback('Team created successfully! You are assigned as team leader.')
      }

      setEditingTeam(null)
      setSelectedTeamId(null)
      await fetchData()
    } catch (err) {
      console.error('Error saving team:', err)
      showFeedback(err.message || 'Failed to save team.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApply = async (teamId, data) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('teamup_apply_to_team', {
        p_team_id: teamId,
        p_introduction: data.introduction,
        p_skills: data.skills,
      })
      if (error) throw error
      showFeedback('Application sent to team leader!')
      setApplyingTeam(null)
      setSelectedTeamId(null)
      await fetchData()
    } catch (err) {
      console.error('Error applying to team:', err)
      showFeedback(err.message || 'Failed to apply.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRespondRequest = async (requestId, decision) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('teamup_respond_to_request', {
        p_request_id: requestId,
        p_decision: decision,
      })
      if (error) throw error
      showFeedback(`Application ${decision === 'accepted' ? 'accepted! Member added.' : 'rejected.'}`)
      await fetchData()
    } catch (err) {
      console.error('Error responding to request:', err)
      showFeedback(err.message || 'Failed to respond to request.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Cancel this pending join request?')) return
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('teamup_cancel_request', { p_request_id: requestId })
      if (error) throw error
      showFeedback('Application cancelled.')
      await fetchData()
    } catch (err) {
      console.error('Error cancelling request:', err)
      showFeedback(err.message || 'Failed to cancel request.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleRecruitment = async (team) => {
    const nextStatus = team.status === 'open' ? 'closed' : 'open'
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('teamup_toggle_recruitment', {
        p_team_id: team.id,
        p_status: nextStatus,
      })
      if (error) throw error
      showFeedback(`Recruitment ${nextStatus === 'open' ? 'reopened' : 'closed'}.`)
      await fetchData()
    } catch (err) {
      console.error('Error changing recruitment status:', err)
      showFeedback(err.message || 'Failed to change status.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveMember = async (teamId, memberUserId) => {
    if (!window.confirm('Remove this member from the team?')) return
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('teamup_remove_member', {
        p_team_id: teamId,
        p_user_id: memberUserId,
      })
      if (error) throw error
      showFeedback('Member removed from team.')
      setSelectedTeamId(null)
      await fetchData()
    } catch (err) {
      console.error('Error removing member:', err)
      showFeedback(err.message || 'Failed to remove member.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLeaveTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to leave this team?')) return
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('teamup_leave_team', { p_team_id: teamId })
      if (error) throw error
      showFeedback('You have left the team.')
      setSelectedTeamId(null)
      await fetchData()
    } catch (err) {
      console.error('Error leaving team:', err)
      showFeedback(err.message || 'Failed to leave team.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Permanently delete this team? This action cannot be undone.')) return
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('teamup_delete_team', { p_team_id: teamId })
      if (error) throw error
      showFeedback('Team deleted.')
      setSelectedTeamId(null)
      await fetchData()
    } catch (err) {
      console.error('Error deleting team:', err)
      showFeedback(err.message || 'Failed to delete team.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            feedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800'
              : 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800'
          }`}
        >
          {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-2 text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--cm-secondary)] text-[var(--cm-text)] border border-[var(--cm-border)]">
              <Users size={14} className="text-[var(--cm-accent)]" />
              <span>Campus Teammate Finder</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>
              TeamUp
            </h1>
            <p className="text-sm text-[var(--cm-muted)] max-w-xl">
              Connect with fellow students for hackathons, coding projects, research initiatives and college competitions. Form your dream squad or join open projects today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingTeam({})}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--cm-accent)] text-[var(--cm-accent-text)] hover:opacity-90 transition shadow-sm"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Create Team</span>
            </button>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border border-[var(--cm-border)] bg-[var(--cm-surface)] text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition"
              title="Refresh teams"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Migration Notice */}
      {migrationRequired && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">TeamUp Migration Required</h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                The database tables for TeamUp have not been initialized yet. Please execute{' '}
                <code className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 font-mono text-xs">
                  database/migration_teamup.sql
                </code>{' '}
                in your Supabase SQL Editor to enable team finding and applications.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && !migrationRequired && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-4">
          <div className="flex items-center gap-3 text-rose-800 dark:text-rose-200 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--cm-border)] pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewTab('browse')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
              viewTab === 'browse'
                ? 'bg-[var(--cm-secondary)] text-[var(--cm-text)] shadow-sm'
                : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
            }`}
          >
            Browse Teams ({enrichedTeams.length})
          </button>
          <button
            type="button"
            onClick={() => setViewTab('my-teams')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition flex items-center gap-2 ${
              viewTab === 'my-teams'
                ? 'bg-[var(--cm-secondary)] text-[var(--cm-text)] shadow-sm'
                : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
            }`}
          >
            <span>My Teams & Requests</span>
            {incomingRequests.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-[var(--cm-accent)] text-[var(--cm-accent-text)]">
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>

        {viewTab === 'browse' && (
          <div className="text-xs text-[var(--cm-muted)]">
            Showing <strong className="text-[var(--cm-text)]">{filteredTeams.length}</strong> available projects
          </div>
        )}
      </div>

      {/* ─── TAB 1: BROWSE TEAMS ────────────────────────────────── */}
      {viewTab === 'browse' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
              <input
                type="text"
                placeholder="Search by project name, description or skills (e.g. React, PyTorch, ROS)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputCls} pl-10`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="md:col-span-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={inputCls}
                aria-label="Filter by project type"
              >
                <option value="all">All Project Types</option>
                {PROJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className={inputCls}
                aria-label="Filter by status"
              >
                <option value="all">All Recruitment Statuses</option>
                <option value="open">Open Only</option>
                <option value="full">Full Teams</option>
                <option value="closed">Closed Teams</option>
              </select>
            </div>
          </div>

          {/* Teams Grid */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 size={32} className="animate-spin text-[var(--cm-accent)] mb-3" />
              <p className="text-sm text-[var(--cm-muted)]">Loading available campus teams...</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <EmptyState
              icon={Users}
              title={searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' ? 'No matching teams' : 'No teams available yet'}
              description={
                searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                  ? 'Try adjusting your search keywords or filters to see more teams.'
                  : 'Be the pioneer! Form the first team for an upcoming hackathon or side project.'
              }
              action={
                searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                  ? {
                      label: 'Reset Filters',
                      onClick: () => {
                        setSearchQuery('')
                        setSelectedCategory('all')
                        setSelectedStatus('all')
                      },
                    }
                  : {
                      label: 'Create a Team',
                      onClick: () => setEditingTeam({}),
                    }
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTeams.map((team) => {
                const userState = getUserTeamState(team)
                return (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onSelect={(t) => setSelectedTeamId(t.id)}
                    onApply={(t) => setApplyingTeam(t)}
                    isLeader={userState.isLeader}
                    isMember={userState.isMember}
                    hasPendingRequest={userState.hasPendingRequest}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: MY TEAMS & REQUESTS ────────────────────────── */}
      {viewTab === 'my-teams' && (
        <div className="space-y-8">
          {/* Section 1: Pending Applications Received */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Pending Applications ({incomingRequests.length})
            </h2>
            {incomingRequests.length === 0 ? (
              <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 text-center text-xs text-[var(--cm-muted)]">
                No pending applications right now.
              </div>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-4 sm:p-5"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[var(--cm-text)]">{req.applicant?.full_name || 'Student Candidate'}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--cm-secondary)] text-[var(--cm-muted)]">
                          {req.applicant?.department || 'Student'}
                        </span>
                        <span className="text-xs text-[var(--cm-muted)]">
                          applied to <strong className="text-[var(--cm-text)]">{req.teamTitle}</strong> ({req.teamCapacity})
                        </span>
                      </div>
                      <p className="text-xs text-[var(--cm-text)] italic bg-[var(--cm-secondary)]/50 p-2.5 rounded-xl border border-[var(--cm-border)]">
                        &quot;{req.introduction}&quot;
                      </p>
                      <div className="text-xs text-[var(--cm-muted)]">
                        <strong>Relevant skills:</strong> {req.skills}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleRespondRequest(req.id, 'accepted')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        <Check size={14} />
                        <span>Accept Member</span>
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleRespondRequest(req.id, 'rejected')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--cm-border)] bg-[var(--cm-surface)] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-50"
                      >
                        <X size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Teams You Lead */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Teams You Lead ({teamsLedByMe.length})
              </h2>
              <button
                type="button"
                onClick={() => setEditingTeam({})}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--cm-accent)] text-[var(--cm-accent-text)] hover:opacity-90 transition"
              >
                <Plus size={14} />
                <span>New Team</span>
              </button>
            </div>

            {teamsLedByMe.length === 0 ? (
              <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 text-center text-xs text-[var(--cm-muted)]">
                You haven&apos;t created any teams yet. Click &quot;New Team&quot; to start one!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamsLedByMe.map((team) => {
                  const badge = getTeamStatusBadge(team.status, team.deadline)
                  const capacity = getTeamCapacityMetrics(team.members.length, team.max_members)
                  return (
                    <div key={team.id} className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--cm-secondary)] text-[var(--cm-text)]">
                              {team.project_type}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${badge.badgeClass}`}>
                              {badge.label}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-[var(--cm-text)]">{team.title}</h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingTeam(team)}
                            className="p-2 rounded-lg text-[var(--cm-muted)] hover:text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition"
                            title="Edit team"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(team.id)}
                            className="p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Delete team"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[var(--cm-muted)] line-clamp-2">{team.description}</p>

                      <div className="space-y-2 pt-2 border-t border-[var(--cm-border)]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--cm-text)]">Members ({capacity.formatted})</span>
                          <button
                            type="button"
                            onClick={() => handleToggleRecruitment(team)}
                            disabled={submitting}
                            className="text-xs text-[var(--cm-accent)] hover:underline font-medium"
                          >
                            {team.status === 'open' ? 'Close Recruitment' : 'Reopen Recruitment'}
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {team.members.map((m) => (
                            <div key={m.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-[var(--cm-secondary)]">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-[var(--cm-surface)] text-[var(--cm-text)] border border-[var(--cm-border)] flex items-center justify-center font-bold text-[10px]">
                                  {m.profile?.full_name?.charAt(0) || 'M'}
                                </div>
                                <span className="font-medium text-[var(--cm-text)]">{m.profile?.full_name || 'Member'}</span>
                                {m.role === 'leader' && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--cm-accent)] text-[var(--cm-accent-text)] font-semibold">
                                    Leader
                                  </span>
                                )}
                              </div>
                              {m.role !== 'leader' && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(team.id, m.user_id)}
                                  className="text-rose-500 hover:text-rose-700 text-xs font-medium"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section 3: Teams You Have Joined */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Teams You Have Joined ({teamsJoinedByMe.length})
            </h2>
            {teamsJoinedByMe.length === 0 ? (
              <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 text-center text-xs text-[var(--cm-muted)]">
                You haven&apos;t joined any other teams yet. Explore open teams in the Browse tab!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamsJoinedByMe.map((team) => (
                  <div key={team.id} className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--cm-secondary)] text-[var(--cm-text)]">
                        {team.project_type}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleLeaveTeam(team.id)}
                        className="text-xs text-rose-500 hover:text-rose-700 font-medium"
                      >
                        Leave Team
                      </button>
                    </div>
                    <h3 className="text-base font-bold text-[var(--cm-text)]">{team.title}</h3>
                    <p className="text-xs text-[var(--cm-muted)] line-clamp-2">{team.description}</p>
                    <div className="flex items-center justify-between text-xs text-[var(--cm-muted)] pt-2 border-t border-[var(--cm-border)]">
                      <span>Leader: {team.creator?.full_name || 'Leader'}</span>
                      <span>{team.members.length} members</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Sent Applications */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Your Applications ({mySentRequests.length})
            </h2>
            {mySentRequests.length === 0 ? (
              <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 text-center text-xs text-[var(--cm-muted)]">
                You have not submitted any applications yet.
              </div>
            ) : (
              <div className="space-y-2">
                {mySentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--cm-text)]">{req.teamTitle}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--cm-secondary)] text-[var(--cm-muted)]">
                          {req.projectType}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--cm-muted)] line-clamp-1">&quot;{req.introduction}&quot;</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${
                          req.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : req.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : req.status === 'cancelled'
                            ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {req.status}
                      </span>
                      {req.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancelRequest(req.id)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODALS ────────────────────────────────────────────── */}
      <TeamDetailsModal
        team={selectedTeam}
        onClose={() => setSelectedTeamId(null)}
        onEdit={(t) => setEditingTeam(t)}
        onApply={(t) => setApplyingTeam(t)}
        onToggleRecruitment={handleToggleRecruitment}
        onRemoveMember={handleRemoveMember}
        onLeaveTeam={handleLeaveTeam}
        {...getUserTeamState(selectedTeam)}
      />

      <TeamFormModal
        key={editingTeam ? editingTeam.id || 'new' : 'closed'}
        isOpen={Boolean(editingTeam)}
        teamToEdit={editingTeam && editingTeam.id ? editingTeam : null}
        onClose={() => setEditingTeam(null)}
        onSave={handleSaveTeam}
        submitting={submitting}
      />

      <ApplyModal
        key={applyingTeam ? applyingTeam.id : 'closed'}
        isOpen={Boolean(applyingTeam)}
        team={applyingTeam}
        onClose={() => setApplyingTeam(null)}
        onApply={handleApply}
        submitting={submitting}
      />
    </div>
  )
}
