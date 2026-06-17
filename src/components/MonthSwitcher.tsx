type MonthSwitcherProps = {
  label: string
  onPrevious: () => void
  onNext: () => void
}

export function MonthSwitcher({
  label,
  onPrevious,
  onNext,
}: MonthSwitcherProps) {
  return (
    <section className="month-switcher" aria-label="Kiválasztott hónap">
      <button type="button" aria-label="Előző hónap" onClick={onPrevious}>
        ‹
      </button>
      <strong>{label}</strong>
      <button type="button" aria-label="Következő hónap" onClick={onNext}>
        ›
      </button>
    </section>
  )
}
