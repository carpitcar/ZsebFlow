export const defaultCategoryColor = '#64748b'

const hexColorPattern = /^#[0-9a-f]{6}$/i

export const normalizeCategoryColor = (
  color: string | null | undefined,
): string => {
  const normalizedColor = color?.trim()

  return normalizedColor && hexColorPattern.test(normalizedColor)
    ? normalizedColor
    : defaultCategoryColor
}
