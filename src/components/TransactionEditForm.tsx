import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { normalizeCurrencyCode } from '../lib/currency'
import { numberToMoneyInput, parseMoneyInput } from '../lib/money'
import { supabase } from '../lib/supabase'
import type {
  Category,
  Transaction,
  TransactionFormValues,
  TransactionType,
  UserCurrency,
} from '../types/finance'
import { MoneyInput } from './MoneyInput'

type Message = {
  type: 'success' | 'error'
  text: string
}

type TransactionEditFormProps = {
  userId: string
  transaction: Transaction
  categories: Category[]
  activeCurrencies: UserCurrency[]
  onClose: () => void
  onSaved: (transaction: Transaction) => Promise<void>
}

const getInitialValues = (transaction: Transaction): TransactionFormValues => ({
  type: transaction.type,
  amount: numberToMoneyInput(transaction.amount),
  currency: normalizeCurrencyCode(transaction.currency),
  categoryId: transaction.category_id,
  transactionDate: transaction.transaction_date,
  merchantName: transaction.merchant_name ?? '',
  note: transaction.note ?? '',
})

export function TransactionEditForm({
  userId,
  transaction,
  categories,
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
    () => categories.filter((category) => category.type === values.type),
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

  const selectedCategoryId =
    values.categoryId &&
    matchingCategories.some((category) => category.id === values.categoryId)
      ? values.categoryId
      : ''

  const updateField = (
    field: keyof TransactionFormValues,
    value: string,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
      ...(field === 'type' ? { categoryId: '' } : {}),
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

    if (!selectedCategoryId) {
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
        category_id: selectedCategoryId,
        type: values.type,
        amount,
        currency: normalizeCurrencyCode(values.currency),
        transaction_date: values.transactionDate,
        merchant_name: merchantName || null,
        note: note || null,
      })
      .eq('id', transaction.id)
      .eq('user_id', userId)
      .select('*, categories(*)')
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

          <label htmlFor="editTransactionCategory">
            Kategória
            <select
              id="editTransactionCategory"
              value={selectedCategoryId}
              onChange={(event) =>
                updateField('categoryId', event.target.value)
              }
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
          </label>

          <label htmlFor="editTransactionDate">
            Dátum
            <input
              id="editTransactionDate"
              type="date"
              value={values.transactionDate}
              onChange={(event) =>
                updateField('transactionDate', event.target.value)
              }
              required
              disabled={isSaving}
            />
          </label>

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
