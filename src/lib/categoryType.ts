import type { Category, TransactionType } from '../types/finance'

export const categoryTypeEmptyMessages: Record<TransactionType, string> = {
  expense: 'Még nincs kiadási kategória.',
  income: 'Még nincs bevételi kategória.',
}

export const categoryMatchesTransactionType = (
  category: Pick<Category, 'type'>,
  transactionType: TransactionType,
) => category.type === transactionType

export const isCategoryCompatibleWithTransactionType = (
  categories: Category[],
  categoryId: string,
  transactionType: TransactionType,
) =>
  categories.some(
    (category) =>
      category.id === categoryId &&
      categoryMatchesTransactionType(category, transactionType),
  )
