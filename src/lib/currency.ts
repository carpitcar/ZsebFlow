const hufFormatter = new Intl.NumberFormat('hu-HU', {
  style: 'currency',
  currency: 'HUF',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

export const toNumber = (value: number | string | null | undefined) => {
  const parsedValue = Number(value ?? 0)
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

export const formatHuf = (value: number) =>
  hufFormatter.format(value).replace(/\u00a0/g, ' ')
