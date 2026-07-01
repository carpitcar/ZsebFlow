export const defaultCurrencyCode = 'HUF'
export const initialCurrencyCodes = ['HUF', 'EUR', 'USD'] as const

const currencyCodePattern = /^[A-Z]{3}$/

export const toNumber = (value: number | string | null | undefined) => {
  const parsedValue = Number(value ?? 0)
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

export const normalizeCurrencyCode = (
  currencyCode: string | null | undefined,
) => {
  const normalizedCurrencyCode = currencyCode?.trim().toUpperCase()

  return normalizedCurrencyCode && currencyCodePattern.test(normalizedCurrencyCode)
    ? normalizedCurrencyCode
    : defaultCurrencyCode
}

export const isValidCurrencyCode = (currencyCode: string) =>
  currencyCodePattern.test(currencyCode)

export const formatCurrency = (
  value: number,
  currencyCode: string | null | undefined,
) => {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode)
  const formatter = new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: normalizedCurrencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  return formatter.format(value).replace(/\u00a0/g, ' ')
}

export const formatHuf = (value: number) =>
  formatCurrency(value, defaultCurrencyCode)
