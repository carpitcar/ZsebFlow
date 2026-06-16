export const sanitizeMoneyInput = (value: string): string =>
  value.replace(/\D/g, '')

export const formatMoneyInput = (value: string): string => {
  const cleanValue = sanitizeMoneyInput(value)

  if (!cleanValue) {
    return ''
  }

  return Number(cleanValue).toLocaleString('hu-HU').replace(/\u00a0/g, ' ')
}

export const parseMoneyInput = (value: string): number =>
  Number(sanitizeMoneyInput(value) || 0)

export const numberToMoneyInput = (value: number | string) => {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return ''
  }

  return String(Math.trunc(parsedValue))
}
