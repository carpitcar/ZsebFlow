export type PaymentMethod =
  | 'unknown'
  | 'card'
  | 'cash'
  | 'bank_transfer'
  | 'revolut'

export type PaymentMethodFilter = 'all' | PaymentMethod

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  unknown: 'Nincs megadva',
  card: 'Bankkártya',
  cash: 'Készpénz',
  bank_transfer: 'Banki utalás',
  revolut: 'Revolut',
}

export const paymentMethodOptions: Array<{
  value: Exclude<PaymentMethod, 'unknown'>
  label: string
}> = [
  { value: 'card', label: paymentMethodLabels.card },
  { value: 'cash', label: paymentMethodLabels.cash },
  { value: 'bank_transfer', label: paymentMethodLabels.bank_transfer },
  { value: 'revolut', label: paymentMethodLabels.revolut },
]

export const paymentMethodFilterOptions: Array<{
  value: PaymentMethodFilter
  label: string
}> = [
  { value: 'all', label: 'Összes' },
  { value: 'card', label: paymentMethodLabels.card },
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
    paymentMethod === 'cash' ||
    paymentMethod === 'bank_transfer' ||
    paymentMethod === 'revolut'
  ) {
    return paymentMethod
  }

  return 'unknown'
}

export const getPaymentMethodLabel = (
  paymentMethod: string | null | undefined,
) => paymentMethodLabels[normalizePaymentMethod(paymentMethod)]
