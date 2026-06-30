type BrandHeaderProps = {
  section?: string
  className?: string
  onHome: () => void
}

function ZsebFlowIcon() {
  return (
    <svg
      className="brand-header__icon"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7 11.5h18a3 3 0 0 1 3 3v9A3.5 3.5 0 0 1 24.5 27h-17A3.5 3.5 0 0 1 4 23.5v-13A3.5 3.5 0 0 1 7.5 7H23"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M8 12V9.8A3.8 3.8 0 0 1 11.8 6H23"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M9 22l4.8-4.8 3.8 3.3L23.5 14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <path
        d="M20 14h3.5v3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  )
}

export function BrandHeader({ section, className, onHome }: BrandHeaderProps) {
  return (
    <h1 className={['brand-header', className].filter(Boolean).join(' ')}>
      <button
        className="brand-header__button"
        type="button"
        aria-label="Ugrás a kezdőlapra"
        onClick={onHome}
      >
        <ZsebFlowIcon />
        <span className="brand-header__title">
          <span className="brand-header__name">
            <span>Zseb</span>
            <span className="brand-header__accent-text">Flow</span>
          </span>
          {section ? (
            <span className="brand-header__section">{section}</span>
          ) : null}
        </span>
      </button>
    </h1>
  )
}
