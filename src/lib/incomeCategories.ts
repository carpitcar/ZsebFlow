import { normalizeCategoryName } from './defaultCategories'
import { normalizePaymentMethod } from './paymentMethod'
import type { Category, PaymentMethod } from '../types/finance'

const legacyPaymentMethodCategoryNames: Record<PaymentMethod, string> = {
  bank_transfer: 'Bankszámla',
  revolut: 'Revolut',
  cash: 'Készpénz',
  szep_card: 'SZÉP-kártya',
  card: 'Bankkártya',
  unknown: 'Nincs megadva',
}

export const getLegacyIncomeCategoryName = (
  paymentMethod: string | null | undefined,
) => legacyPaymentMethodCategoryNames[normalizePaymentMethod(paymentMethod)]

export const findLegacyIncomeCategory = (
  categories: Category[],
  paymentMethod: string | null | undefined,
) => {
  const categoryName = getLegacyIncomeCategoryName(paymentMethod)
  const normalizedCategoryName = normalizeCategoryName(categoryName)

  return (
    categories.find(
      (category) =>
        category.type === 'income' &&
        normalizeCategoryName(category.name) === normalizedCategoryName,
    ) ?? null
  )
}
