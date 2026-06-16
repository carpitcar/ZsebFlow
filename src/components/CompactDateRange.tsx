import { formatShortDate } from '../lib/date'

type CompactDateRangeProps = {
  dateFromInput: string
  dateToInput: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path
        d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export function CompactDateRange({
  dateFromInput,
  dateToInput,
  onDateFromChange,
  onDateToChange,
}: CompactDateRangeProps) {
  return (
    <>
      <label className="date-field desktop-date-field" htmlFor="dateFrom">
        Tól
        <input
          id="dateFrom"
          type="date"
          value={dateFromInput}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </label>
      <label className="date-field desktop-date-field" htmlFor="dateTo">
        Ig
        <input
          id="dateTo"
          type="date"
          value={dateToInput}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </label>

      <label
        className="compact-date-button mobile-date-field"
        htmlFor="dateFromMobile"
      >
        <CalendarIcon />
        <span>{formatShortDate(dateFromInput)}</span>
        <input
          id="dateFromMobile"
          type="date"
          aria-label="Kezdő dátum kiválasztása"
          value={dateFromInput}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </label>
      <label
        className="compact-date-button mobile-date-field"
        htmlFor="dateToMobile"
      >
        <CalendarIcon />
        <span>{formatShortDate(dateToInput)}</span>
        <input
          id="dateToMobile"
          type="date"
          aria-label="Záró dátum kiválasztása"
          value={dateToInput}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </label>
    </>
  )
}
