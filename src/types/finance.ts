export type TransactionType = 'income' | 'expense'
export type TransactionTypeFilter = 'all' | TransactionType

export type CashAccount = {
  id: string
  user_id?: string
  name: string | null
  opening_balance: number | string | null
  is_active?: boolean | null
}

export type Category = {
  id: string
  user_id?: string
  name: string
  type: TransactionType
  icon: string | null
}

export type Transaction = {
  id: string
  user_id: string
  account_id: string
  category_id: string
  type: TransactionType
  amount: number | string
  transaction_date: string
  merchant_name: string | null
  note: string | null
  created_at?: string
  categories?: Category | null
}

export type TransactionFormValues = {
  type: TransactionType
  amount: string
  categoryId: string
  transactionDate: string
  merchantName: string
  note: string
}
