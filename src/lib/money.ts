const completeMoneyInputPattern = /^\d+(?:\.\d{1,2})?$/
const editableMoneyInputPattern = /^\d*(?:[.,]\d{0,2})?$/
const duplicatedTrailingSeparatorPattern = /^\d+[.,]{2}$/

export const isEditableMoneyInput = (value: string): boolean =>
  editableMoneyInputPattern.test(value) ||
  duplicatedTrailingSeparatorPattern.test(value)

export const numberToMoneyInput = (value: number | string) => {
  const normalizedValue = String(value).trim().replace(/\s/g, '')

  if (!normalizedValue) {
    return ''
  }

  const parsedValue = Number(normalizedValue.replace(',', '.'))

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return ''
  }

  return normalizedValue
    .replace(',', '.')
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
    .replace('.', ',')
}

export const parseMoneyInput = (value: string): number | null => {
  const normalizedValue = value.trim().replace(/\s/g, '').replace(',', '.')

  if (!completeMoneyInputPattern.test(normalizedValue)) {
    return null
  }

  const parsedValue = Number(normalizedValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null
  }

  return parsedValue
}
