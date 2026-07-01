import { normalizeCategoryColor } from './categoryColor'
import { supabase } from './supabase'
import type { Category, TransactionType } from '../types/finance'

type DefaultCategory = {
  name: string
  type: TransactionType
  icon: string
  color: string
}

export const defaultIncomeCategories: DefaultCategory[] = []

export const normalizeCategoryName = (name: string) =>
  name.trim().toLocaleLowerCase('hu-HU')

const getDefaultIncomeCategoryStorageKey = (userId: string) =>
  `zsebflow-default-income-categories-${userId}`

export async function ensureDefaultIncomeCategories(userId: string) {
  const storageKey = getDefaultIncomeCategoryStorageKey(userId)

  if (localStorage.getItem(storageKey) === 'done') {
    return { data: [] as Category[], error: null }
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'income')

  if (error) {
    return { data: [] as Category[], error }
  }

  const existingCategories = (data ?? []) as Category[]
  const existingNames = new Set(
    existingCategories.map((category) => normalizeCategoryName(category.name)),
  )
  const missingCategories = defaultIncomeCategories.filter(
    (category) => !existingNames.has(normalizeCategoryName(category.name)),
  )

  if (missingCategories.length > 0) {
    const { error: insertError } = await supabase.from('categories').insert(
      missingCategories.map((category) => ({
        user_id: userId,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: normalizeCategoryColor(category.color),
      })),
    )

    if (insertError) {
      return { data: existingCategories, error: insertError }
    }
  }

  const { data: refreshedRows, error: refreshError } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'income')

  if (!refreshError) {
    localStorage.setItem(storageKey, 'done')
  }

  return {
    data: (refreshedRows ?? existingCategories) as Category[],
    error: refreshError,
  }
}
