import type { PaymentSource } from '../types/finance'

export type PaymentSourceFilter = 'all' | string

export const getPaymentSourceLabel = (transaction: {
  payment_method?: string | null
  payment_sources?: Pick<PaymentSource, 'name'> | null
}) =>
  transaction.payment_sources?.name ??
  transaction.payment_method?.trim() ??
  'Nincs megadva'

export const getPaymentSourceColor = (transaction: {
  payment_sources?: Pick<PaymentSource, 'color'> | null
}) => transaction.payment_sources?.color ?? '#64748b'

export const getPaymentSourceIcon = (transaction: {
  payment_sources?: Pick<PaymentSource, 'icon'> | null
}) => transaction.payment_sources?.icon ?? '•'
