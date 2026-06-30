import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatHungarianDate, formatHungarianMonth, formatLocalDateInput } from '../lib/date'

type DatePickerVariant = 'default' | 'wizard' | 'compact'

type DatePickerProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  min?: string
  max?: string
  placeholder?: string
  variant?: DatePickerVariant
  className?: string
}

const parseLocalDate = (dateValue: string) => {
  if (!dateValue) {
    return null
  }

  const date = new Date(`${dateValue}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const getToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1)

const getMonthDays = (visibleMonth: Date) => {
  const firstDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  )
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate()

  return [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_day, index) =>
        new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1),
    ),
  ]
}

const isOutOfRange = (date: Date, min?: string, max?: string) => {
  const value = formatLocalDateInput(date)

  return Boolean((min && value < min) || (max && value > max))
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
      <path d="M8 3.8v3.4M16 3.8v3.4M4.5 10h15" />
    </svg>
  )
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  min,
  max,
  placeholder = 'Válassz dátumot',
  variant = 'default',
  className,
}: DatePickerProps) {
  const generatedId = useId()
  const labelId = `${id || generatedId}-label`
  const dialogId = `${id || generatedId}-calendar`
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selectedDate = parseLocalDate(value)
    const initialDate = selectedDate ?? getToday()
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  })

  const selectedDate = parseLocalDate(value)
  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth])

  const closePicker = () => {
    setIsOpen(false)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }

  const openPicker = () => {
    const currentDate = parseLocalDate(value) ?? getToday()
    setVisibleMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
    setIsOpen(true)
  }

  const handleSelectDate = (date: Date) => {
    onChange(formatLocalDateInput(date))
    closePicker()
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePicker()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const displayValue = value ? formatHungarianDate(value) : placeholder
  const wrapperClassName = [
    'date-picker-field',
    className,
    variant === 'wizard' ? 'wizard-field-group' : '',
    variant === 'compact' ? 'date-picker-field--compact mobile-date-field' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const triggerClassName = [
    'date-picker-trigger',
    variant === 'wizard' ? 'wizard-date-select' : '',
    variant === 'compact' ? 'compact-date-button' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapperClassName}>
      <span
        className={[
          variant === 'wizard' ? 'wizard-field-label' : '',
          variant === 'compact' ? 'sr-only' : '',
          variant === 'default' ? 'date-picker-label' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        id={labelId}
      >
        {label}
      </span>
      <button
        className={triggerClassName}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? dialogId : undefined}
        aria-labelledby={labelId}
        aria-required={required}
        disabled={disabled}
        ref={triggerRef}
        onClick={openPicker}
      >
        {variant === 'compact' ? (
          <CalendarIcon />
        ) : (
          <>
            {variant === 'wizard' ? (
              <span className="wizard-field-icon" aria-hidden="true">
                <CalendarIcon />
              </span>
            ) : null}
            <span
              className={
                variant === 'wizard'
                  ? 'wizard-date-select-text'
                  : 'date-picker-trigger-text'
              }
            >
              {displayValue}
            </span>
            {variant === 'wizard' ? (
              <span className="wizard-category-chevron" aria-hidden="true">
                ›
              </span>
            ) : null}
          </>
        )}
      </button>
      {isOpen ? (
        <div className="date-picker-layer">
          <button
            className="date-picker-backdrop"
            type="button"
            aria-label="Mégse"
            onClick={closePicker}
          />
          <section
            className="date-picker-dialog"
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
          >
            <div className="date-picker-header">
              <button
                className="date-picker-month-button"
                type="button"
                aria-label="Előző hónap"
                onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
              >
                ‹
              </button>
              <strong id={`${dialogId}-title`}>
                {formatHungarianMonth(visibleMonth)}
              </strong>
              <button
                className="date-picker-month-button"
                type="button"
                aria-label="Következő hónap"
                onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
              >
                ›
              </button>
            </div>

            <div className="date-picker-weekdays" aria-hidden="true">
              {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="date-picker-grid">
              {monthDays.map((date, index) => {
                if (!date) {
                  return <span aria-hidden="true" key={`empty-${index}`} />
                }

                const dateValue = formatLocalDateInput(date)
                const isSelected = selectedDate
                  ? dateValue === formatLocalDateInput(selectedDate)
                  : false

                return (
                  <button
                    className={isSelected ? 'selected' : ''}
                    type="button"
                    key={dateValue}
                    aria-pressed={isSelected}
                    disabled={isOutOfRange(date, min, max)}
                    onClick={() => handleSelectDate(date)}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>

            <button
              className="secondary-button date-picker-cancel"
              type="button"
              onClick={closePicker}
            >
              Mégse
            </button>
          </section>
        </div>
      ) : null}
    </div>
  )
}
