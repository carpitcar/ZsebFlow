export const formatLocalDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const getCurrentLocalMonth = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export const addMonths = (month: Date, amount: number) =>
  new Date(month.getFullYear(), month.getMonth() + amount, 1)

export const getMonthRange = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0)

  return {
    firstDay: formatLocalDateInput(firstDay),
    lastDay: formatLocalDateInput(lastDay),
  }
}

export const getCurrentMonthRange = () => getMonthRange(getCurrentLocalMonth())

export const getPreviousMonthRange = () =>
  getMonthRange(addMonths(getCurrentLocalMonth(), -1))

export const getCurrentYearRange = () => {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), 0, 1)
  const lastDay = new Date(now.getFullYear(), 11, 31)

  return {
    firstDay: formatLocalDateInput(firstDay),
    lastDay: formatLocalDateInput(lastDay),
  }
}

export const formatHungarianMonth = (month: Date) =>
  new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
  }).format(month)

export const formatHungarianDate = (dateValue: string) =>
  new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${dateValue}T00:00:00`))

export const formatCompactDate = (dateValue: string) =>
  new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateValue}T00:00:00`))

export const formatPeriodLabel = (dateFrom: string, dateTo: string) =>
  `${formatCompactDate(dateFrom)} – ${formatCompactDate(dateTo)}`
