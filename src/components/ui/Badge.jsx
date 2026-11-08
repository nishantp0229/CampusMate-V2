// ============================================================
// Badge.jsx — Reusable badge/chip component for CampusMate
// ============================================================

// ─── COLOR MAPPING ──────────────────────────────────────────
// Maps variant names to Tailwind class strings
const VARIANT_CLASSES = {
  primary: 'bg-[#EAF2FF] text-[#5B9BF8] dark:bg-[#A9C9FF]/10 dark:text-[#A9C9FF]',
  success: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  danger:  'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  purple:  'bg-[#F0EBFF] text-[#9B7FE8] dark:bg-[#C8B6FF]/10 dark:text-[#C8B6FF]',
  orange:  'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
  default: 'bg-[#F7F8FC] text-[#737B8C] dark:bg-white/5 dark:text-[#A0A8B8]',
};

// ─── BADGE COMPONENT ────────────────────────────────────────
/**
 * A small inline badge/chip for labels, statuses, categories, etc.
 *
 * @param {string}  variant   - Color variant (see VARIANT_CLASSES above)
 * @param {ReactNode} children - Badge label text or elements
 * @param {string}  className  - Additional Tailwind classes
 */
function Badge({ variant = 'default', children, className = '' }) {
  const variantClass = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium ${variantClass} ${className}`}
    >
      {children}
    </span>
  );
}

// ─── HELPER FUNCTIONS ───────────────────────────────────────
// These helpers convert domain values to Badge variant + label pairs.
// Usage: const { variant, label } = priorityBadge(task.priority)

/**
 * Returns badge props for a task priority level.
 * @param {'low'|'medium'|'high'} priority
 */
export function priorityBadge(priority) {
  const map = {
    high:   { variant: 'danger',  label: 'High' },
    medium: { variant: 'warning', label: 'Medium' },
    low:    { variant: 'success', label: 'Low' },
  };
  return map[priority] ?? { variant: 'default', label: priority };
}

/**
 * Returns badge props for a task status.
 * @param {'pending'|'completed'} status
 */
export function statusBadge(status) {
  const map = {
    completed: { variant: 'success', label: 'Completed' },
    pending:   { variant: 'warning', label: 'Pending' },
  };
  return map[status] ?? { variant: 'default', label: status };
}

/**
 * Returns badge props for an event category.
 * @param {'workshop'|'hackathon'|'fest'|'seminar'|'sports'|'cultural'|'general'} category
 */
export function categoryBadge(category) {
  const map = {
    hackathon: { variant: 'danger',  label: 'Hackathon' },
    workshop:  { variant: 'primary', label: 'Workshop' },
    fest:      { variant: 'purple',  label: 'Fest' },
    seminar:   { variant: 'orange',  label: 'Seminar' },
    sports:    { variant: 'success', label: 'Sports' },
    cultural:  { variant: 'purple',  label: 'Cultural' },
    general:   { variant: 'default', label: 'General' },
  };
  return map[category] ?? { variant: 'default', label: category };
}

/**
 * Returns badge props for a lost-and-found item type.
 * @param {'lost'|'found'} type
 */
export function typeBadge(type) {
  const map = {
    lost:  { variant: 'danger',  label: 'Lost' },
    found: { variant: 'success', label: 'Found' },
  };
  return map[type] ?? { variant: 'default', label: type };
}

/**
 * Returns badge props for a resource type.
 * @param {'link'|'note'|'pdf'|'video'|'other'} type
 */
export function resourceTypeBadge(type) {
  const map = {
    pdf:   { variant: 'danger',  label: 'PDF' },
    link:  { variant: 'primary', label: 'Link' },
    note:  { variant: 'warning', label: 'Note' },
    video: { variant: 'purple',  label: 'Video' },
    other: { variant: 'default', label: 'Other' },
  };
  return map[type] ?? { variant: 'default', label: type };
}

export default Badge;
