import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatLocalDateInput } from '../lib/date'
import { normalizeCurrencyCode } from '../lib/currency'
import { parseMoneyInput } from '../lib/money'
import type {
  CashAccount,
  Category,
  TransactionFormValues,
  TransactionType,
  UserCurrency,
} from '../types/finance'
import { MoneyInput } from './MoneyInput'

type Message = {
  type: 'success' | 'error'
  text: string
}

type TransactionFormProps = {
  userId: string
  account: CashAccount
  categories: Category[]
  activeCurrencies: UserCurrency[]
  defaultCurrency: string
  onClose: () => void
  onSaved: () => Promise<void>
}

const getInitialValues = (defaultCurrency: string): TransactionFormValues => ({
  type: 'expense',
  amount: '',
  currency: normalizeCurrencyCode(defaultCurrency),
  categoryId: '',
  transactionDate: formatLocalDateInput(new Date()),
  merchantName: '',
  note: '',
})

export function TransactionForm({
  userId,
  account,
  categories,
  activeCurrencies,
  defaultCurrency,
  onClose,
  onSaved,
}: TransactionFormProps) {
  const [values, setValues] = useState<TransactionFormValues>(() =>
    getInitialValues(defaultCurrency),
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
        is_active: true,
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
        text: 'Válassz kategóriát a tranzakcióhoz.',
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

    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      account_id: account.id,
      category_id: selectedCategoryId,
      type: values.type,
      amount,
      currency: normalizeCurrencyCode(values.currency),
      transaction_date: values.transactionDate,
      merchant_name: merchantName || null,
      note: note || null,
    })

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült menteni a tranzakciót: ${error.message}`,
      })
      setIsSaving(false)
      return
    }

    await onSaved()
    setIsSaving(false)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transactionFormTitle"
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">Új tétel</p>
            <h2 id="transactionFormTitle">Új tranzakció</h2>
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
            >
              Kiadás
            </button>
            <button
              type="button"
              className={values.type === 'income' ? 'active' : ''}
              onClick={() => handleTypeChange('income')}
            >
              Bevétel
            </button>
          </div>

          <MoneyInput
            id="transactionAmount"
            label="Összeg"
            value={values.amount}
            onChange={(value) => updateField('amount', value)}
            required
          />

          <label htmlFor="transactionCurrency">
            Pénznem
            <select
              id="transactionCurrency"
              value={values.currency}
              onChange={(event) => updateField('currency', event.target.value)}
              required
            >
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.currency_code}>
                  {currency.currency_code}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="transactionCategory">
            Kategória
            <select
              id="transactionCategory"
              value={selectedCategoryId}
              onChange={(event) =>
                updateField('categoryId', event.target.value)
              }
              required
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

          <label htmlFor="transactionDate">
            Dátum
            <input
              id="transactionDate"
              type="date"
              value={values.transactionDate}
              onChange={(event) =>
                updateField('transactionDate', event.target.value)
              }
              required
            />
          </label>

          <label htmlFor="transactionMerchant">
            Partner vagy üzlet neve
            <input
              id="transactionMerchant"
              type="text"
              value={values.merchantName}
              onChange={(event) =>
                updateField('merchantName', event.target.value)
              }
            />
          </label>

          <label htmlFor="transactionNote">
            Megjegyzés
            <textarea
              id="transactionNote"
              value={values.note}
              onChange={(event) => updateField('note', event.target.value)}
              rows={3}
            />
          </label>

          {message ? (
            <p className={`message ${message.type}`} role="status">
              {message.text}
            </p>
          ) : null}

          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Mentés...' : 'Tranzakció mentése'}
          </button>
        </form>
      </section>
    </div>
  )
}
