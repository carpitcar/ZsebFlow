import { supabase } from './supabase'
import {
  defaultCurrencyCode,
  initialCurrencyCodes,
  normalizeCurrencyCode,
} from './currency'
import type { UserCurrency } from '../types/finance'

export const getDefaultCurrency = (currencies: UserCurrency[]) =>
  currencies.find((currency) => currency.is_default) ??
  currencies.find((currency) => currency.currency_code === defaultCurrencyCode) ??
  currencies[0] ??
  null

export const getActiveCurrencies = (currencies: UserCurrency[]) =>
  currencies.filter((currency) => currency.is_active)

const normalizeSingleDefault = async (
  userId: string,
  currencies: UserCurrency[],
) => {
  const defaultRows = currencies.filter((currency) => currency.is_default)

  if (defaultRows.length === 1 && defaultRows[0].is_active) {
    return { data: currencies, error: null }
  }

  const selectedDefault =
    currencies.find(
      (currency) =>
        currency.currency_code === defaultCurrencyCode && currency.is_default,
    ) ??
    currencies.find((currency) => currency.currency_code === defaultCurrencyCode) ??
    defaultRows[0] ??
    currencies[0] ??
    null

  if (!selectedDefault) {
    return { data: currencies, error: null }
  }

  const { error: clearError } = await supabase
    .from('user_currencies')
    .update({ is_default: false })
    .eq('user_id', userId)

  if (clearError) {
    return { data: currencies, error: clearError }
  }

  const { error: defaultError } = await supabase
    .from('user_currencies')
    .update({ is_default: true, is_active: true })
    .eq('id', selectedDefault.id)
    .eq('user_id', userId)

  if (defaultError) {
    return { data: currencies, error: defaultError }
  }

  return {
    data: currencies.map((currency) =>
      currency.id === selectedDefault.id
        ? { ...currency, is_default: true, is_active: true }
        : { ...currency, is_default: false },
    ),
    error: null,
  }
}

export async function ensureInitialUserCurrencies(userId: string) {
  const { data, error } = await supabase
    .from('user_currencies')
    .select('*')
    .eq('user_id', userId)
    .order('currency_code', { ascending: true })

  if (error) {
    return { data: [] as UserCurrency[], error }
  }

  const existingRows = ((data ?? []) as UserCurrency[]).map((currency) => ({
    ...currency,
    currency_code: normalizeCurrencyCode(currency.currency_code),
  }))
  const existingCodes = new Set(
    existingRows.map((currency) => currency.currency_code),
  )
  const missingCodes = initialCurrencyCodes.filter(
    (currencyCode) => !existingCodes.has(currencyCode),
  )

  if (missingCodes.length > 0) {
    const { error: insertError } = await supabase
      .from('user_currencies')
      .insert(
        missingCodes.map((currencyCode) => ({
          user_id: userId,
          currency_code: currencyCode,
          is_active: true,
          is_default:
            currencyCode === defaultCurrencyCode &&
            !existingRows.some((currency) => currency.is_default),
        })),
      )

    if (insertError) {
      return { data: existingRows, error: insertError }
    }
  }

  const { data: refreshedRows, error: refreshError } = await supabase
    .from('user_currencies')
    .select('*')
    .eq('user_id', userId)
    .order('currency_code', { ascending: true })

  if (refreshError) {
    return { data: existingRows, error: refreshError }
  }

  const currencies = ((refreshedRows ?? []) as UserCurrency[]).map((currency) => ({
    ...currency,
    currency_code: normalizeCurrencyCode(currency.currency_code),
  }))

  return normalizeSingleDefault(userId, currencies)
}
