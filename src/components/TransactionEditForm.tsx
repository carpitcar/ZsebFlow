import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { normalizeCurrencyCode } from '../lib/currency'
import {
  categoryMatchesTransactionType,
  categoryTypeEmptyMessages,
  isCategoryCompatibleWithTransactionType,
} from '../lib/categoryType'
import {
  getSourceLegacyPaymentMethod,
  normalizePaymentMethod,
} from '../lib/paymentMethod'
import {
  findPaymentSourceByLegacyMethod,
  resolveTransactionPaymentSource,
} from '../lib/paymentSources'
import { numberToMoneyInput, parseMoneyInput } from '../lib/money'
import { supabase } from '../lib/supabase'
import type {
  Category,
  PaymentSource,
  Transaction,
  TransactionFormValues,
  TransactionType,
  UserCurrency,
} from '../types/finance'
import { DatePicker } from './DatePicker'
import { MoneyInput } from './MoneyInput'

type Message = {
  type: 'success' | 'error'
  text: string
}

type TransactionEditFormProps = {
  userId: string
  transaction: Transaction
  categories: Category[]
  paymentSources: PaymentSource[]
  activeCurrencies: UserCurrency[]
  onClose: () => void
  onSaved: (transaction: Transaction) => Promise<void>
}

const getInitialValues = (transaction: Transaction): TransactionFormValues => ({
  type: transaction.type,
  amount: numberToMoneyInput(transaction.amount),
  currency: normalizeCurrencyCode(transaction.currency),
  paymentMethod: normalizePaymentMethod(transaction.payment_method),
  paymentSourceId: transaction.payment_source_id ?? '',
  categoryId: transaction.category_id ?? '',
  transactionDate: transaction.transaction_date,
  merchantName: transaction.merchant_name ?? '',
  note: transaction.note ?? '',
})

export function TransactionEditForm({
  userId,
  transaction,
  categories,
  paymentSources,
  activeCurrencies,
  onClose,
  onSaved,
}: TransactionEditFormProps) {
  const [values, setValues] = useState<TransactionFormValues>(() =>
    getInitialValues(transaction),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const matchingCategories = useMemo(
    () =>
      categories.filter((category) =>
        categoryMatchesTransactionType(category, values.type),
      ),
    [categories, values.type],
  )

  const currencyOptions = useMemo(() => {
    const normalizedValue = normalizeCurrencyCode(values.currency)
    const normalizedCurrencies = activeCurrencies.map((currency) => ({
      ...currency,
      currency_code: normalizeCurrencyCode(currency.currency_code),
    }))

    if (
      normalizedCurrencies.some(
        (currency) => currency.currency_code === normalizedValue,
      )
    ) {
      return normalizedCurrencies
    }

    return [
      {
        id: normalizedValue,
        user_id: userId,
        currency_code: normalizedValue,
        is_default: false,
        is_active: false,
      },
      ...normalizedCurrencies,
    ]
  }, [activeCurrencies, userId, values.currency])

  const isExpense = values.type === 'expense'
  const visiblePaymentSources = useMemo(
    () =>
      paymentSources.filter(
        (source) =>
          source.is_active &&
          (isExpense ? source.use_for_expense : source.use_for_income),
      ),
    [isExpense, paymentSources],
  )
  const selectedPaymentSource = useMemo(
    () =>
      resolveTransactionPaymentSource(paymentSources, {
        payment_source_id: values.paymentSourceId,
        payment_method: values.paymentMethod,
      }),
    [paymentSources, values.paymentMethod, values.paymentSourceId],
  )
  const paymentSourceOptions = useMemo(
    () =>
      selectedPaymentSource &&
      !visiblePaymentSources.some((source) => source.id === selectedPaymentSource.id)
        ? [selectedPaymentSource, ...visiblePaymentSources]
        : visiblePaymentSources,
    [selectedPaymentSource, visiblePaymentSources],
  )

  const selectedCategoryId =
    values.categoryId &&
    matchingCategories.some((category) => category.id === values.categoryId)
      ? values.categoryId
      : ''

  useEffect(() => {
    if (
      values.categoryId &&
      !isCategoryCompatibleWithTransactionType(
        categories,
        values.categoryId,
        values.type,
      )
    ) {
      setValues((currentValues) => ({
        ...currentValues,
        categoryId: '',
      }))
    }
  }, [categories, values.categoryId, values.type])

  useEffect(() => {
    if (values.paymentSourceId) return

    const fallbackSource =
      transaction.payment_source_id
        ? paymentSources.find((source) => source.id === transaction.payment_source_id)
        : findPaymentSourceByLegacyMethod(paymentSources, transaction.payment_method)

    if (fallbackSource) {
      setValues((currentValues) => ({
        ...currentValues,
        paymentSourceId: fallbackSource.id,
        paymentMethod: getSourceLegacyPaymentMethod(fallbackSource),
      }))
    }
  }, [
    paymentSources,
    transaction.payment_method,
    transaction.payment_source_id,
    values.paymentSourceId,
  ])

  const updateField = (
    field: keyof TransactionFormValues,
    value: string,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
      ...(field === 'type'
        ? {
            categoryId:
              value === 'expense' &&
              isCategoryCompatibleWithTransactionType(
                categories,
                currentValues.categoryId,
                value as TransactionType,
              )
                ? currentValues.categoryId
                : '',
            paymentMethod:
              currentValues.paymentSourceId
                ? getSourceLegacyPaymentMethod(
                    paymentSources.find(
                      (source) => source.id === currentValues.paymentSourceId,
                    ),
                  )
                : currentValues.paymentMethod,
          }
        : {}),
    }))
  }

  const handleTypeChange = (type: TransactionType) => {
    updateField('type', type)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const amount = parseMoneyInput(values.amount)
    const merchantName = values.merchantName.trim()
    const note = values.note.trim()

    if (amount <= 0) {
      setMessage({
        type: 'error',
        text: 'Az összegnek pozitív számnak kell lennie.',
      })
      return
    }

    if (!selectedPaymentSource) {
      setMessage({
        type: 'error',
        text: isExpense ? 'Válassz fizetési helyet.' : 'Válaszd ki, hová érkezett.',
      })
      return
    }

    if (isExpense && !selectedCategoryId) {
      setMessage({
        type: 'error',
        text: 'Válassz a típushoz tartozó kategóriát.',
      })
      return
    }

    if (!values.transactionDate) {
      setMessage({
        type: 'error',
        text: 'Add meg a tranzakció dátumát.',
      })
      return
    }

    setIsSaving(true)

    const { data, error } = await supabase
      .from('transactions')
      .update({
        category_id: isExpense ? selectedCategoryId : null,
        payment_source_id: selectedPaymentSource.id,
        type: values.type,
        amount,
        currency: normalizeCurrencyCode(values.currency),
        payment_method: selectedPaymentSource.system_key
          ? normalizePaymentMethod(selectedPaymentSource.system_key)
          : 'unknown',
        transaction_date: values.transactionDate,
        merchant_name: merchantName || null,
        note: note || null,
      })
      .eq('id', transaction.id)
      .eq('user_id', userId)
      .select('*, categories(*), payment_sources(*)')
      .single()

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült módosítani a tranzakciót: ${error.message}`,
      })
      setIsSaving(false)
      return
    }

    await onSaved(data as Transaction)
    setIsSaving(false)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transactionEditTitle"
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tranzakció</p>
            <h2 id="transactionEditTitle">Tranzakció szerkesztése</h2>
          </div>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
          >
            Bezárás
          </button>
        </div>

        <form className="transaction-form" onSubmit={handleSubmit}>
          <div className="type-switch" aria-label="Tranzakció típusa">
            <button
              type="button"
              className={values.type === 'expense' ? 'active' : ''}
              onClick={() => handleTypeChange('expense')}
              disabled={isSaving}
            >
              Kiadás
            </button>
            <button
              type="button"
              className={values.type === 'income' ? 'active' : ''}
              onClick={() => handleTypeChange('income')}
              disabled={isSaving}
            >
              Bevétel
            </button>
          </div>

          <MoneyInput
            id="editTransactionAmount"
            label="Összeg"
            value={values.amount}
            onChange={(value) => updateField('amount', value)}
            required
          />

          <label htmlFor="editTransactionCurrency">
            Pénznem
            <select
              id="editTransactionCurrency"
              value={values.currency}
              onChange={(event) => updateField('currency', event.target.value)}
              required
              disabled={isSaving}
            >
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.currency_code}>
                  {currency.currency_code}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="editTransactionPaymentSource">
            {isExpense ? 'Mivel fizettél?' : 'Hová érkezett?'}
            <select
              id="editTransactionPaymentSource"
              value={selectedPaymentSource?.id ?? ''}
              onChange={(event) => {
                const source = paymentSources.find(
                  (paymentSource) => paymentSource.id === event.target.value,
                )
                setValues((currentValues) => ({
                  ...currentValues,
                  paymentSourceId: event.target.value,
                  paymentMethod: getSourceLegacyPaymentMethod(source),
                }))
              }}
              required
              disabled={isSaving}
            >
              <option value="">Válassz fizetési helyet</option>
              {paymentSourceOptions.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.icon ? `${source.icon} ` : ''}
                  {source.name}
                </option>
              ))}
            </select>
          </label>

          {isExpense ? (
            <label htmlFor="editTransactionCategory">
              Kategória
              <select
                id="editTransactionCategory"
                value={selectedCategoryId}
                onChange={(event) => updateField('categoryId', event.target.value)}
                required
                disabled={isSaving}
              >
                <option value="">Válassz kategóriát</option>
                {matchingCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon ? `${category.icon} ` : ''}
                    {category.name}
                  </option>
                ))}
              </select>
              {matchingCategories.length === 0 ? (
                <span className="field-hint">
                  {categoryTypeEmptyMessages[values.type]}
                </span>
              ) : null}
            </label>
          ) : null}

          <DatePicker
            id="editTransactionDate"
            label="Dátum"
            value={values.transactionDate}
            onChange={(value) => updateField('transactionDate', value)}
            required
            disabled={isSaving}
          />

          <label htmlFor="editTransactionMerchant">
            Partner vagy üzlet neve
            <input
              id="editTransactionMerchant"
              type="text"
              value={values.merchantName}
              onChange={(event) =>
                updateField('merchantName', event.target.value)
              }
              disabled={isSaving}
            />
          </label>

          <label htmlFor="editTransactionNote">
            Megjegyzés
            <textarea
              id="editTransactionNote"
              value={values.note}
              onChange={(event) => updateField('note', event.target.value)}
              rows={3}
              disabled={isSaving}
            />
          </label>

          {message ? (
            <p className={`message ${message.type}`} role="status">
              {message.text}
            </p>
          ) : null}

          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Mentés...' : 'Módosítás mentése'}
          </button>
        </form>
      </section>
    </div>
  )
}
