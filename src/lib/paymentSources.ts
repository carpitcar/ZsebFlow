import { normalizeCategoryColor } from './categoryColor'
import {
  legacyPaymentSourceDefaults,
  normalizePaymentMethod,
  type PaymentMethod,
} from './paymentMethod'
import { supabase } from './supabase'
import type { PaymentSource } from '../types/finance'

export type CreatePaymentSourcePayload = {
  user_id: string
  name: string
  icon?: string | null
  color?: string | null
  use_for_income?: boolean
  use_for_expense?: boolean
}

export type UpdatePaymentSourcePayload = Partial<
  Pick<
    PaymentSource,
    | 'name'
    | 'icon'
    | 'color'
    | 'is_active'
    | 'use_for_income'
    | 'use_for_expense'
    | 'sort_order'
  >
>

const normalizeSourceName = (name: string) => name.trim().toLocaleLowerCase('hu-HU')

const sortPaymentSources = (sources: PaymentSource[]) =>
  [...sources].sort((firstSource, secondSource) => {
    if (firstSource.is_active !== secondSource.is_active) {
      return firstSource.is_active ? -1 : 1
    }

    if (firstSource.sort_order !== secondSource.sort_order) {
      return firstSource.sort_order - secondSource.sort_order
    }

    return firstSource.name.localeCompare(secondSource.name, 'hu-HU')
  })

export async function ensureDefaultPaymentSources(userId: string) {
  const { data: existingRows, error: loadError } = await supabase
    .from('payment_sources')
    .select('*')
    .eq('user_id', userId)

  if (loadError) return { data: [] as PaymentSource[], error: loadError }

  const existingSources = (existingRows ?? []) as PaymentSource[]
  const existingNames = new Set(existingSources.map((source) => normalizeSourceName(source.name)))
  const existingSystemKeys = new Set(
    existingSources
      .map((source) => source.system_key)
      .filter((systemKey): systemKey is Exclude<PaymentMethod, 'unknown'> =>
        Boolean(systemKey),
      ),
  )

  const missingDefaults = legacyPaymentSourceDefaults.filter(
    (defaultSource) =>
      !existingSystemKeys.has(defaultSource.value) &&
      !existingNames.has(normalizeSourceName(defaultSource.name)),
  )

  if (missingDefaults.length === 0) {
    return { data: sortPaymentSources(existingSources), error: null }
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from('payment_sources')
    .insert(
      missingDefaults.map((defaultSource) => ({
        user_id: userId,
        name: defaultSource.name,
        system_key: defaultSource.value,
        icon: defaultSource.icon,
        color: defaultSource.color,
        sort_order: defaultSource.sortOrder,
        is_active: true,
        use_for_income: true,
        use_for_expense: true,
      })),
    )
    .select('*')

  if (insertError) return { data: sortPaymentSources(existingSources), error: insertError }

  return {
    data: sortPaymentSources([...existingSources, ...((insertedRows ?? []) as PaymentSource[])]),
    error: null,
  }
}

export async function loadPaymentSources(userId: string) {
  const defaultResult = await ensureDefaultPaymentSources(userId)
  if (defaultResult.error) return defaultResult

  const { data, error } = await supabase
    .from('payment_sources')
    .select('*')
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  return { data: sortPaymentSources((data ?? []) as PaymentSource[]), error }
}

export async function createPaymentSource(payload: CreatePaymentSourcePayload) {
  const { data, error } = await supabase
    .from('payment_sources')
    .insert({
      user_id: payload.user_id,
      name: payload.name.trim(),
      system_key: null,
      icon: payload.icon?.trim() || null,
      color: normalizeCategoryColor(payload.color),
      is_active: true,
      use_for_income: payload.use_for_income ?? true,
      use_for_expense: payload.use_for_expense ?? true,
      sort_order: 100,
    })
    .select('*')
    .single()

  return { data: data as PaymentSource | null, error }
}

export async function updatePaymentSource(
  sourceId: string,
  userId: string,
  payload: UpdatePaymentSourcePayload,
) {
  const nextPayload: UpdatePaymentSourcePayload = {
    ...payload,
  }

  if ('name' in payload) nextPayload.name = payload.name?.trim() ?? ''
  if ('icon' in payload) nextPayload.icon = payload.icon?.trim() || null
  if ('color' in payload) {
    nextPayload.color = payload.color ? normalizeCategoryColor(payload.color) : payload.color
  }

  const { data, error } = await supabase
    .from('payment_sources')
    .update(nextPayload)
    .eq('id', sourceId)
    .eq('user_id', userId)
    .select('*')
    .single()

  return { data: data as PaymentSource | null, error }
}

export async function getPaymentSourceUsageCount(sourceId: string, userId: string) {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('payment_source_id', sourceId)

  return { count: count ?? 0, error }
}

export async function deleteOrArchivePaymentSource(source: PaymentSource) {
  const { count, error: countError } = await getPaymentSourceUsageCount(
    source.id,
    source.user_id,
  )

  if (countError) return { archived: false, error: countError }

  if (count > 0 || source.system_key) {
    const { error } = await supabase
      .from('payment_sources')
      .update({ is_active: false })
      .eq('id', source.id)
      .eq('user_id', source.user_id)

    return { archived: true, error }
  }

  const { error } = await supabase
    .from('payment_sources')
    .delete()
    .eq('id', source.id)
    .eq('user_id', source.user_id)

  return { archived: false, error }
}

export const findPaymentSourceByLegacyMethod = (
  sources: PaymentSource[],
  paymentMethod: string | null | undefined,
) => {
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod)
  if (normalizedPaymentMethod === 'unknown') return null

  return (
    sources.find((source) => source.system_key === normalizedPaymentMethod) ??
    null
  )
}

export const resolveTransactionPaymentSource = (
  sources: PaymentSource[],
  transaction: {
    payment_source_id?: string | null
    payment_method?: string | null
    payment_sources?: PaymentSource | null
  },
) =>
  transaction.payment_sources ??
  sources.find((source) => source.id === transaction.payment_source_id) ??
  findPaymentSourceByLegacyMethod(sources, transaction.payment_method)
