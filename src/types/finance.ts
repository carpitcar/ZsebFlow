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

export type PaymentMethod =
  | 'unknown'
  | 'card'
  | 'szep_card'
  | 'cash'
  | 'bank_transfer'
  | 'revolut'

export type PaymentSource = {
  id: string
  user_id: string
  name: string
  system_key: Exclude<PaymentMethod, 'unknown'> | null
  icon: string | null
  color: string | null
  is_active: boolean
  use_for_income: boolean
  use_for_expense: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

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
  category_id: string | null
  payment_source_id: string | null
  type: TransactionType
  amount: number | string
  currency: string
  payment_method: PaymentMethod
  transaction_date: string
  merchant_name: string | null
  note: string | null
  created_at?: string
  categories?: Category | null
  payment_sources?: PaymentSource | null
}

export type TransactionFormValues = {
  type: TransactionType
  amount: string
  currency: string
  paymentMethod: PaymentMethod
  paymentSourceId: string
  categoryId: string
  transactionDate: string
  merchantName: string
  note: string
}
