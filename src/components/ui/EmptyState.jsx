// EmptyState.jsx — Centered empty-state component for CampusMate

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="flex items-center justify-center w-14 h-14 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-secondary)] mb-4">
          <Icon size={24} className="text-[var(--cm-text)]" strokeWidth={1.5} />
        </div>
      )}

      <h3
        className="text-base font-semibold text-[var(--cm-text)] mb-2"
        style={{ fontFamily: 'Poppins, sans-serif' }}
      >
        {title}
      </h3>

      <p className="text-sm text-[var(--cm-muted)] max-w-xs leading-relaxed">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[var(--cm-accent)] text-[var(--cm-accent-text)] rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export default EmptyState
