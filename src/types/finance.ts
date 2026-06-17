export type TransactionType = 'income' | 'expense'
export type TransactionTypeFilter = 'all' | TransactionType

export type CashAccount = {
  id: string
  user_id?: string
  name: string | null
  opening_balance: number | string | null
  is_active?: boolean | null
}

export type UserCurrency = {
  id: string
  user_id: string
  currency_code: string
  is_default: boolean
  is_active: boolean
  created_at?: string
}

export type PaymentMethod = 'unknown' | 'card' | 'cash' | 'bank_transfer'

export type Category = {
  id: string
  user_id?: string
  name: string
  type: TransactionType
  icon: string | null
  color: string
}

export type Transaction = {
  id: string
  user_id: string
  account_id: string
  category_id: string
  type: TransactionType
  amount: number | string
  currency: string
  payment_method: PaymentMethod
  transaction_date: string
  merchant_name: string | null
  note: string | null
  created_at?: string
  categories?: Category | null
}

export type TransactionFormValues = {
  type: TransactionType
  amount: string
  currency: string
  paymentMethod: PaymentMethod
  categoryId: string
  transactionDate: string
  merchantName: string
  note: string
}
