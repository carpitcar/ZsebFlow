import type { PaymentSource, TransactionType } from '../types/finance'

export type PaymentMethod =
  | 'unknown'
  | 'card'
  | 'szep_card'
  | 'cash'
  | 'bank_transfer'
  | 'revolut'

export type PaymentMethodFilter = 'all' | PaymentMethod

export type PaymentSourceFilter = 'all' | string

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  unknown: 'Nincs megadva',
  card: 'Bankkártya',
  szep_card: 'SZÉP-kártya',
  cash: 'Készpénz',
  bank_transfer: 'Banki utalás',
  revolut: 'Revolut',
}

export const legacyPaymentSourceDefaults: Array<{
  value: Exclude<PaymentMethod, 'unknown'>
  name: string
  icon: string
  color: string
  sortOrder: number
}> = [
  { value: 'bank_transfer', name: 'Bankszámla', icon: '🏦', color: '#2563eb', sortOrder: 10 },
  { value: 'card', name: 'Bankkártya', icon: '💳', color: '#7c3aed', sortOrder: 20 },
  { value: 'cash', name: 'Készpénz', icon: '💵', color: '#16a34a', sortOrder: 30 },
  { value: 'revolut', name: 'Revolut', icon: 'R', color: '#06b6d4', sortOrder: 40 },
  { value: 'szep_card', name: 'SZÉP-kártya', icon: '✚', color: '#f59e0b', sortOrder: 50 },
]

export const paymentMethodOptions: Array<{
  value: Exclude<PaymentMethod, 'unknown'>
  label: string
}> = legacyPaymentSourceDefaults.map((source) => ({
  value: source.value,
  label: source.name,
}))

export const paymentMethodFilterOptions: Array<{
  value: PaymentMethodFilter
  label: string
}> = [
  { value: 'all', label: 'Összes' },
  { value: 'card', label: paymentMethodLabels.card },
  { value: 'szep_card', label: paymentMethodLabels.szep_card },
  { value: 'cash', label: paymentMethodLabels.cash },
  { value: 'bank_transfer', label: paymentMethodLabels.bank_transfer },
  { value: 'revolut', label: paymentMethodLabels.revolut },
]

export const normalizePaymentMethod = (
  paymentMethod: string | null | undefined,
): PaymentMethod => {
  if (
    paymentMethod === 'unknown' ||
    paymentMethod === 'card' ||
    paymentMethod === 'szep_card' ||
    paymentMethod === 'cash' ||
    paymentMethod === 'bank_transfer' ||
    paymentMethod === 'revolut'
  ) {
    return paymentMethod
  }

  return 'unknown'
}

export const isExpensePaymentMethod = (
  paymentMethod: string | null | undefined,
) =>
  paymentMethodOptions.some(
    (option) => option.value === normalizePaymentMethod(paymentMethod),
  )

export const getPaymentMethodLabel = (
  paymentMethod: string | null | undefined,
  _transactionType?: TransactionType,
) => {
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod)

  return paymentMethodLabels[normalizedPaymentMethod]
}

export const getSourceLegacyPaymentMethod = (
  paymentSource: Pick<PaymentSource, 'system_key'> | null | undefined,
): PaymentMethod => normalizePaymentMethod(paymentSource?.system_key)

export const getPaymentSourceLabel = (
  transaction: {
    payment_method?: string | null
    payment_source_id?: string | null
    payment_sources?: Pick<PaymentSource, 'name'> | null
  },
  transactionType?: TransactionType,
) =>
  transaction.payment_sources?.name ??
  getPaymentMethodLabel(transaction.payment_method, transactionType)

export const getPaymentSourceColor = (
  transaction: {
    payment_method?: string | null
    payment_sources?: Pick<PaymentSource, 'color'> | null
  },
) =>
  transaction.payment_sources?.color ??
  legacyPaymentSourceDefaults.find(
    (source) => source.value === normalizePaymentMethod(transaction.payment_method),
  )?.color ??
  '#64748b'

export const getPaymentSourceIcon = (
  transaction: {
    payment_method?: string | null
    payment_sources?: Pick<PaymentSource, 'icon'> | null
  },
) =>
  transaction.payment_sources?.icon ??
  legacyPaymentSourceDefaults.find(
    (source) => source.value === normalizePaymentMethod(transaction.payment_method),
  )?.icon ??
  '•'
