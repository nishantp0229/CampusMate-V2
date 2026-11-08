// ============================================================
// EmptyState.jsx — Centered empty-state illustration for CampusMate
// ============================================================

/**
 * Displays a friendly empty state with an icon, title, description,
 * and an optional call-to-action button.
 *
 * @param {React.ComponentType} icon        - A Lucide icon component to render
 * @param {string}              title       - Bold heading (Poppins font)
 * @param {string}              description - Muted subtitle explaining the empty state
 * @param {{ label: string, onClick: () => void }} [action] - Optional CTA button
 */
function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon wrapped in a soft colored circle */}
      {Icon && (
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#EAF2FF] dark:bg-[#A9C9FF]/10 mb-5">
          <Icon
            size={28}
            className="text-[#5B9BF8] dark:text-[#A9C9FF]"
            strokeWidth={1.5}
          />
        </div>
      )}

      {/* Title — Poppins heading */}
      <h3
        className="text-base font-semibold text-[#242B3A] dark:text-[#F1F1FC] mb-2"
        style={{ fontFamily: 'Poppins, sans-serif' }}
      >
        {title}
      </h3>

      {/* Description — Inter muted text */}
      <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] max-w-xs leading-relaxed">
        {description}
      </p>

      {/* Optional action button (primary style) */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#A9C9FF] text-white rounded-xl font-medium text-sm hover:bg-[#8BB8F8] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
