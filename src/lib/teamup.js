// src/lib/teamup.js — Pure helpers and business logic for TeamUp

export const PROJECT_TYPES = ['Hackathon', 'Project', 'Competition', 'Other']

export const STATUS_OPTIONS = ['open', 'closed', 'full']

/**
 * Filter teams by search term, category and recruitment status.
 */
export function filterTeams(teams = [], { search = '', category = 'all', status = 'all' } = {}) {
  const query = search.trim().toLowerCase()
  return teams.filter((team) => {
    if (!team) return false

    // Category filter
    if (category && category !== 'all') {
      if (team.project_type?.toLowerCase() !== category.toLowerCase()) {
        return false
      }
    }

    // Status filter
    if (status && status !== 'all') {
      if (team.status?.toLowerCase() !== status.toLowerCase()) {
        return false
      }
    }

    // Search query filter
    if (query) {
      const matchTitle = team.title?.toLowerCase().includes(query)
      const matchDesc = team.description?.toLowerCase().includes(query)
      const matchSkills = Array.isArray(team.skills) && team.skills.some((s) => s?.toLowerCase().includes(query))
      if (!matchTitle && !matchDesc && !matchSkills) {
        return false
      }
    }

    return true
  })
}

/**
 * Determine if team recruitment deadline has passed.
 */
export function isDeadlinePassed(deadline) {
  if (!deadline) return false
  const time = new Date(deadline).getTime()
  return !Number.isNaN(time) && time <= Date.now()
}

/**
 * Compute team capacity metrics safely.
 */
export function getTeamCapacityMetrics(currentMembers = 0, maxMembers = 2) {
  const count = Math.max(0, Number(currentMembers) || 0)
  const max = Math.max(2, Math.min(15, Number(maxMembers) || 2))
  const percentage = Math.min(100, Math.round((count / max) * 100))
  const isFull = count >= max
  const spotsLeft = Math.max(0, max - count)

  return {
    count,
    max,
    percentage,
    isFull,
    spotsLeft,
    formatted: `${count} / ${max}`,
  }
}

/**
 * Get display badge properties for team recruitment status.
 */
export function getTeamStatusBadge(status, deadline) {
  if (deadline && isDeadlinePassed(deadline)) {
    return {
      label: 'Expired',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      canApply: false,
    }
  }

  switch (status?.toLowerCase()) {
    case 'open':
      return {
        label: 'Open',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        canApply: true,
      }
    case 'full':
      return {
        label: 'Full',
        badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        canApply: false,
      }
    case 'closed':
    default:
      return {
        label: 'Closed',
        badgeClass: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
        canApply: false,
      }
  }
}

/**
 * Parse comma-separated or space-delimited skill tags into a clean array.
 */
export function parseSkillsInput(input) {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim()).filter(Boolean)
  }
  if (typeof input !== 'string') return []
  return input
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Validate team creation and update payload.
 */
export function validateTeamForm({
  title,
  description,
  projectType,
  skills,
  maxMembers,
  deadline,
  projectUrl,
}) {
  const errors = {}

  const cleanTitle = (title || '').trim()
  if (cleanTitle.length < 3 || cleanTitle.length > 100) {
    errors.title = 'Title must be between 3 and 100 characters.'
  }

  const cleanDesc = (description || '').trim()
  if (cleanDesc.length < 10 || cleanDesc.length > 2000) {
    errors.description = 'Description must be between 10 and 2000 characters.'
  }

  if (!PROJECT_TYPES.includes(projectType)) {
    errors.projectType = `Project type must be one of: ${PROJECT_TYPES.join(', ')}.`
  }

  const parsedSkills = parseSkillsInput(skills)
  if (parsedSkills.length === 0) {
    errors.skills = 'Please specify at least one skill or role needed.'
  }

  const numMax = Number(maxMembers)
  if (!Number.isInteger(numMax) || numMax < 2 || numMax > 15) {
    errors.maxMembers = 'Team capacity must be an integer between 2 and 15.'
  }

  if (deadline) {
    const deadlineTime = new Date(deadline).getTime()
    if (Number.isNaN(deadlineTime) || deadlineTime <= Date.now()) {
      errors.deadline = 'Recruitment deadline must be a future date and time.'
    }
  }

  if (projectUrl && projectUrl.trim()) {
    const cleanUrl = projectUrl.trim()
    if (!/^https?:\/\//i.test(cleanUrl)) {
      errors.projectUrl = 'URL must start with http:// or https://'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: {
      title: cleanTitle,
      description: cleanDesc,
      projectType,
      skills: parsedSkills,
      maxMembers: numMax,
      deadline: deadline || null,
      projectUrl: projectUrl?.trim() || null,
    },
  }
}

/**
 * Validate join request application payload.
 */
export function validateJoinRequest({ introduction, skills }) {
  const errors = {}

  const cleanIntro = (introduction || '').trim()
  if (cleanIntro.length < 5 || cleanIntro.length > 1000) {
    errors.introduction = 'Pitch/intro must be between 5 and 1000 characters.'
  }

  const cleanSkills = (skills || '').trim()
  if (cleanSkills.length < 1 || cleanSkills.length > 500) {
    errors.skills = 'Please summarize your relevant skills (1-500 characters).'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: {
      introduction: cleanIntro,
      skills: cleanSkills,
    },
  }
}

/**
 * Format relative or localized date string safely.
 */
export function formatTeamDate(dateStr) {
  if (!dateStr) return 'No deadline'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
