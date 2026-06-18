import { useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { formatCurrency, normalizeCurrencyCode } from '../lib/currency'
import { formatLocalDateInput } from '../lib/date'
import { parseMoneyInput } from '../lib/money'
import {
  getPaymentMethodLabel,
  normalizePaymentMethod,
  paymentMethodOptions,
  type PaymentMethod,
} from '../lib/paymentMethod'
import { supabase } from '../lib/supabase'
import type {
  CashAccount,
  Category,
  TransactionFormValues,
  TransactionType,
  UserCurrency,
} from '../types/finance'
import { MoneyInput } from './MoneyInput'
import { TransactionWizardProgress } from './TransactionWizardProgress'

type Message = {
  type: 'success' | 'error'
  text: string
}

type TransactionWizardProps = {
  userId: string
  account: CashAccount
  categories: Category[]
  activeCurrencies: UserCurrency[]
  defaultCurrency: string
  onClose: () => void
  onSaved: () => Promise<void>
}

const totalSteps = 4

const transactionTypeLabels: Record<TransactionType, string> = {
  expense: 'Kiadás',
  income: 'Bevétel',
}

const getInitialValues = (defaultCurrency: string): TransactionFormValues => ({
  type: 'expense',
  amount: '',
  currency: normalizeCurrencyCode(defaultCurrency),
  paymentMethod: 'card',
  categoryId: '',
  transactionDate: formatLocalDateInput(new Date()),
  merchantName: '',
  note: '',
})

export function TransactionWizard({
  userId,
  account,
  categories,
  activeCurrencies,
  defaultCurrency,
  onClose,
  onSaved,
}: TransactionWizardProps) {
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<TransactionFormValues>(() =>
    getInitialValues(defaultCurrency),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const matchingCategories = useMemo(
    () => categories.filter((category) => category.type === values.type),
    [categories, values.type],
  )

  const selectedCategory = useMemo(
    () =>
      matchingCategories.find((category) => category.id === values.categoryId) ??
      null,
    [matchingCategories, values.categoryId],
  )

  const selectedCategoryId = selectedCategory?.id ?? ''

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

  const amount = parseMoneyInput(values.amount)
  const isAmountValid = amount > 0
  const canContinueDetails =
    Boolean(values.paymentMethod) &&
    Boolean(selectedCategoryId) &&
    Boolean(values.transactionDate)

  const hasMeaningfulData =
    step > 1 ||
    values.amount.trim() !== '' ||
    values.categoryId !== '' ||
    values.merchantName.trim() !== '' ||
    values.note.trim() !== '' ||
    values.currency !== normalizeCurrencyCode(defaultCurrency) ||
    values.paymentMethod !== 'card' ||
    values.transactionDate !== formatLocalDateInput(new Date())

  const updateField = (field: keyof TransactionFormValues, value: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
      ...(field === 'type' &&
      !categories.some(
        (category) => category.id === currentValues.categoryId && category.type === value,
      )
        ? { categoryId: '' }
        : {}),
    }))
  }

  const handleClose = () => {
    if (isSaving) {
      return
    }

    if (
      hasMeaningfulData &&
      !window.confirm('A megadott adatok elvesznek. Biztosan bezárod?')
    ) {
      return
    }

    onClose()
  }

  const handleTypeSelect = (type: TransactionType) => {
    setMessage(null)
    updateField('type', type)
    setStep(2)
  }

  const handleAmountNext = () => {
    setMessage(null)

    if (!isAmountValid) {
      setMessage({
        type: 'error',
        text: 'Az összegnek pozitív számnak kell lennie.',
      })
      return
    }

    setStep(3)
  }

  const handleDetailsNext = () => {
    setMessage(null)

    if (!values.paymentMethod) {
      setMessage({
        type: 'error',
        text: 'Válassz fizetési módot.',
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

    setStep(4)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (isSaving) {
      return
    }

    const merchantName = values.merchantName.trim()
    const note = values.note.trim()

    if (!isAmountValid) {
      setMessage({
        type: 'error',
        text: 'Az összegnek pozitív számnak kell lennie.',
      })
      setStep(2)
      return
    }

    if (!selectedCategoryId || !values.transactionDate) {
      setMessage({
        type: 'error',
        text: 'Hiányzik a kategória vagy a dátum.',
      })
      setStep(3)
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
      payment_method: normalizePaymentMethod(values.paymentMethod),
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

    setMessage({
      type: 'success',
      text: 'A tranzakció mentése sikerült.',
    })
    await onSaved()
    setIsSaving(false)
    onClose()
  }

  const renderBackButton = () =>
    step > 1 ? (
      <button
        className="wizard-back-button"
        type="button"
        onClick={() => {
          setMessage(null)
          setStep((currentStep) => Math.max(1, currentStep - 1))
        }}
        disabled={isSaving}
        aria-label="Vissza az előző lépéshez"
      >
        ‹
      </button>
    ) : (
      <span className="wizard-header-spacer" />
    )

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-panel transaction-wizard-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transactionWizardTitle"
      >
        <div className="wizard-header">
          {renderBackButton()}
          <div className="wizard-heading">
            <TransactionWizardProgress currentStep={step} totalSteps={totalSteps} />
            <h2 id="transactionWizardTitle">Új tétel</h2>
          </div>
          <button
            className="wizard-close-button"
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Bezárás"
          >
            ×
          </button>
        </div>

        <form className="transaction-wizard-form" onSubmit={handleSubmit}>
          {step === 1 ? (
            <section
              className="wizard-step wizard-type-step"
              aria-label="Tranzakció típusa"
            >
              <p className="wizard-question">
                Milyen tételt szeretnél rögzíteni?
              </p>
              <div className="wizard-type-grid">
                {(['expense', 'income'] as TransactionType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={[
                      'wizard-type-card',
                      type,
                      values.type === type ? 'active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleTypeSelect(type)}
                    aria-pressed={values.type === type}
                  >
                    <span className="wizard-type-symbol">
                      {type === 'expense' ? '-' : '+'}
                    </span>
                    <span className="wizard-type-label">
                      {transactionTypeLabels[type]}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="wizard-step" aria-label="Pénznem és összeg">
              <p className={`wizard-selected-type ${values.type}`}>
                {transactionTypeLabels[values.type]}
              </p>

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

              <div className="money-field-with-currency">
                <MoneyInput
                  id="transactionAmount"
                  label="Összeg"
                  value={values.amount}
                  onChange={(value) => updateField('amount', value)}
                  required
                />
                <span>{normalizeCurrencyCode(values.currency)}</span>
              </div>

              <button
                className="primary-button wizard-primary-button"
                type="button"
                onClick={handleAmountNext}
                disabled={!isAmountValid}
              >
                Tovább
              </button>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="wizard-step" aria-label="Fizetés, kategória és dátum">
              <div className="wizard-field-group">
                <span className="wizard-field-label">Fizetési mód</span>
                <div className="wizard-payment-grid">
                  {paymentMethodOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        values.paymentMethod === option.value ? 'active' : ''
                      }
                      onClick={() =>
                        updateField('paymentMethod', option.value as PaymentMethod)
                      }
                      aria-pressed={values.paymentMethod === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wizard-field-group">
                <span className="wizard-field-label">Kategória</span>
                <div className="wizard-category-list">
                  {matchingCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={
                        selectedCategoryId === category.id ? 'active' : ''
                      }
                      onClick={() => updateField('categoryId', category.id)}
                      aria-pressed={selectedCategoryId === category.id}
                      style={{ '--category-color': category.color } as CSSProperties}
                    >
                      <span
                        className="wizard-category-icon"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.icon || '•'}
                      </span>
                      <span>{category.name}</span>
                    </button>
                  ))}
                </div>
              </div>

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

              <button
                className="primary-button wizard-primary-button"
                type="button"
                onClick={handleDetailsNext}
                disabled={!canContinueDetails}
              >
                Tovább
              </button>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="wizard-step" aria-label="Partner és megjegyzés">
              <label htmlFor="transactionMerchant">
                Partner vagy üzlet
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

              <dl className="wizard-summary">
                <div>
                  <dt>Típus</dt>
                  <dd>{transactionTypeLabels[values.type]}</dd>
                </div>
                <div>
                  <dt>Összeg</dt>
                  <dd>{formatCurrency(amount, values.currency)}</dd>
                </div>
                <div>
                  <dt>Kategória</dt>
                  <dd>{selectedCategory?.name ?? 'Nincs kiválasztva'}</dd>
                </div>
                <div>
                  <dt>Fizetési mód</dt>
                  <dd>{getPaymentMethodLabel(values.paymentMethod)}</dd>
                </div>
                <div>
                  <dt>Dátum</dt>
                  <dd>{values.transactionDate}</dd>
                </div>
              </dl>

              <button
                className="primary-button wizard-primary-button"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? 'Mentés...' : 'Mentés'}
              </button>
            </section>
          ) : null}

          {message ? (
            <p className={`message ${message.type}`} role="status">
              {message.text}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  )
}
