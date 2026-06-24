import type { TransactionType } from '../types/finance'

export type PaymentMethod =
  | 'unknown'
  | 'card'
  | 'szep_card'
  | 'cash'
  | 'bank_transfer'
  | 'revolut'

export type PaymentMethodFilter = 'all' | PaymentMethod

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  unknown: 'Nincs megadva',
  card: 'Bankkártya',
  szep_card: 'SZÉP-kártya',
  cash: 'Készpénz',
  bank_transfer: 'Banki utalás',
  revolut: 'Revolut',
}

export const paymentMethodOptions: Array<{
  value: Exclude<PaymentMethod, 'unknown'>
  label: string
}> = [
  { value: 'card', label: paymentMethodLabels.card },
  { value: 'szep_card', label: paymentMethodLabels.szep_card },
  { value: 'cash', label: paymentMethodLabels.cash },
  { value: 'bank_transfer', label: paymentMethodLabels.bank_transfer },
  { value: 'revolut', label: paymentMethodLabels.revolut },
]

export const incomeDestinationLabels: Record<
  Extract<PaymentMethod, 'bank_transfer' | 'revolut' | 'cash' | 'szep_card'>,
  string
> = {
  bank_transfer: 'Bankszámla',
  revolut: paymentMethodLabels.revolut,
  cash: paymentMethodLabels.cash,
  szep_card: paymentMethodLabels.szep_card,
}

export const incomeDestinationOptions: Array<{
  value: keyof typeof incomeDestinationLabels
  label: string
}> = [
  { value: 'bank_transfer', label: incomeDestinationLabels.bank_transfer },
  { value: 'revolut', label: incomeDestinationLabels.revolut },
  { value: 'cash', label: incomeDestinationLabels.cash },
  { value: 'szep_card', label: incomeDestinationLabels.szep_card },
]

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

export const isIncomeDestination = (
  paymentMethod: string | null | undefined,
) =>
  incomeDestinationOptions.some(
    (option) => option.value === normalizePaymentMethod(paymentMethod),
  )

export const getPaymentMethodLabel = (
  paymentMethod: string | null | undefined,
  transactionType?: TransactionType,
) => {
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod)

  if (
    transactionType === 'income' &&
    normalizedPaymentMethod in incomeDestinationLabels
  ) {
    return incomeDestinationLabels[
      normalizedPaymentMethod as keyof typeof incomeDestinationLabels
    ]
  }

  return paymentMethodLabels[normalizedPaymentMethod]
}
