import { DatePicker } from './DatePicker'

type CompactDateRangeProps = {
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
}

export function CompactDateRange({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: CompactDateRangeProps) {
  return (
    <>
      <DatePicker
        id="dateFrom"
        label="Tól"
        value={dateFrom}
        onChange={onDateFromChange}
        max={dateTo}
        className="desktop-date-field"
      />
      <DatePicker
        id="dateTo"
        label="Ig"
        value={dateTo}
        onChange={onDateToChange}
        min={dateFrom}
        className="desktop-date-field"
      />

      <DatePicker
        id="dateFromMobile"
        label="Kezdő dátum kiválasztása"
        value={dateFrom}
        onChange={onDateFromChange}
        max={dateTo}
        variant="compact"
      />
      <DatePicker
        id="dateToMobile"
        label="Záró dátum kiválasztása"
        value={dateTo}
        onChange={onDateToChange}
        min={dateFrom}
        variant="compact"
      />
    </>
  )
}
