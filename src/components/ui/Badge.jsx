// ============================================================
// Badge.jsx — Reusable badge/chip component for CampusMate
// ============================================================

// ─── COLOR MAPPING ──────────────────────────────────────────
// Maps variant names to Tailwind class strings
const VARIANT_CLASSES = {
  primary: 'bg-[var(--cm-secondary)] text-[var(--cm-text)]',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  danger:  'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  purple:  'bg-[var(--cm-secondary)] text-[var(--cm-muted)]',
  orange:  'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  default: 'bg-[var(--cm-secondary)] text-[var(--cm-muted)]',
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
