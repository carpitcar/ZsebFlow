import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  FocusEvent,
  FormEvent,
  KeyboardEvent,
} from 'react'
import { formatCurrency, normalizeCurrencyCode } from '../lib/currency'
import { formatLocalDateInput } from '../lib/date'
import { parseMoneyInput } from '../lib/money'
import { useVisualViewport } from '../hooks/useVisualViewport'
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
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const isSavingRef = useRef(false)
  const hasCompletedSaveRef = useRef(false)
  const savePointerIntentRef = useRef(false)
  const sheetRef = useRef<HTMLElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const visualViewport = useVisualViewport()

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    document.body.classList.add('wizard-sheet-open')

    window.setTimeout(() => {
      sheetRef.current?.focus()
    }, 0)

    return () => {
      document.body.classList.remove('wizard-sheet-open')
      returnFocusRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle(
      'wizard-keyboard-open',
      visualViewport.isKeyboardOpen,
    )

    return () => {
      document.body.classList.remove('wizard-keyboard-open')
    }
  }, [visualViewport.isKeyboardOpen])

  const wizardViewportStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--visual-viewport-height': visualViewport.height
          ? `${visualViewport.height}px`
          : '100dvh',
        '--visual-viewport-offset-top': `${visualViewport.offsetTop}px`,
      }) as CSSProperties,
    [visualViewport.height, visualViewport.offsetTop],
  )

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
    setIsCategoryPickerOpen(false)
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
    setIsCategoryPickerOpen(false)

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

    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const isSaveButton =
      submitter instanceof HTMLButtonElement &&
      submitter.dataset.wizardAction === 'save'

    if (!isSaveButton || step !== 4 || !savePointerIntentRef.current) {
      savePointerIntentRef.current = false
      return
    }

    savePointerIntentRef.current = false

    if (isSavingRef.current || hasCompletedSaveRef.current) {
      return
    }

    setMessage(null)
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

    isSavingRef.current = true
    setIsSaving(true)

    try {
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
        isSavingRef.current = false
        setIsSaving(false)
        return
      }

      hasCompletedSaveRef.current = true
      setMessage({
        type: 'success',
        text: 'A tranzakció mentése sikerült.',
      })
      await onSaved()
      onClose()
    } catch (error) {
      if (!hasCompletedSaveRef.current) {
        isSavingRef.current = false
        setIsSaving(false)
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Ismeretlen hiba történt.'
      setMessage({
        type: 'error',
        text: `Nem sikerült menteni a tranzakciót: ${errorMessage}`,
      })
    }
  }

  const handleSavePointerDown = () => {
    savePointerIntentRef.current = true

    window.setTimeout(() => {
      savePointerIntentRef.current = false
    }, 1200)
  }

  const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || event.target instanceof HTMLTextAreaElement) {
      return
    }

    if (step === 4) {
      event.preventDefault()
      return
    }

    const target = event.target

    if (
      target instanceof HTMLElement &&
      target.matches('input, select')
    ) {
      event.preventDefault()
    }
  }

  const handleSheetKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      handleClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const sheet = sheetRef.current

    if (!sheet) {
      return
    }

    const focusableElements = Array.from(
      sheet.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null)

    if (focusableElements.length === 0) {
      event.preventDefault()
      sheet.focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  const handleControlFocus = (event: FocusEvent<HTMLFormElement>) => {
    const target = event.target

    if (
      !(target instanceof HTMLElement) ||
      !target.matches('input, select, textarea')
    ) {
      return
    }

    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, visualViewport.isKeyboardOpen ? 180 : 260)
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
      <button
        className="wizard-back-button"
        type="button"
        disabled
        aria-label="Nincs előző lépés"
      >
        ‹
      </button>
    )

  const renderPrimaryAction = () => {
    if (step === 2) {
      return (
        <button
          className="primary-button wizard-primary-button"
          type="button"
          onClick={handleAmountNext}
          disabled={!isAmountValid}
        >
          Tovább
        </button>
      )
    }

    if (step === 3) {
      return (
        <button
          className="primary-button wizard-primary-button"
          type="button"
          onClick={handleDetailsNext}
          disabled={!canContinueDetails}
        >
          Tovább
        </button>
      )
    }

    if (step === 4) {
      return (
        <button
          className="primary-button wizard-primary-button"
          type="submit"
          data-wizard-action="save"
          onPointerDown={handleSavePointerDown}
          disabled={isSaving}
        >
          {isSaving ? 'Mentés...' : 'Mentés'}
        </button>
      )
    }

    return null
  }

  const handleCategorySelect = (categoryId: string) => {
    updateField('categoryId', categoryId)
    setIsCategoryPickerOpen(false)
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      style={wizardViewportStyle}
    >
      <section
        ref={sheetRef}
        className={[
          'modal-panel transaction-wizard-panel',
          visualViewport.isKeyboardOpen ? 'is-keyboard-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transactionWizardTitle"
        tabIndex={-1}
        onKeyDown={handleSheetKeyDown}
      >
        <div className="wizard-drag-handle" aria-hidden="true" />
        <h2 className="sr-only" id="transactionWizardTitle">
          Új tétel
        </h2>
        <div className="wizard-header">
          {renderBackButton()}
          <div className="wizard-heading">
            <TransactionWizardProgress currentStep={step} totalSteps={totalSteps} />
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

        <form
          className={[
            'transaction-wizard-form',
            step === 1 ? 'is-type-step' : 'has-footer',
          ].join(' ')}
          onSubmit={handleSubmit}
          onFocusCapture={handleControlFocus}
          onKeyDown={handleFormKeyDown}
        >
          <div className="transaction-wizard-content">
            {step === 1 ? (
              <section
                className="wizard-step wizard-type-step"
                aria-label="Tranzakció típusa"
              >
                <div className="wizard-step-intro">
                  <h3>Új tétel</h3>
                  <p>Milyen tételt szeretnél rögzíteni?</p>
                </div>
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
                      <span className="wizard-type-copy">
                        <span className="wizard-type-label">
                          {transactionTypeLabels[type]}
                        </span>
                        <span className="wizard-type-description">
                          {type === 'income'
                            ? 'Fizetés, bevétel, jóváírás'
                            : 'Vásárlás, számla, költés'}
                        </span>
                      </span>
                      <span className="wizard-type-chevron" aria-hidden="true">
                        ›
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
                  <button
                    className={[
                      'wizard-category-select',
                      selectedCategory ? 'has-selection' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    type="button"
                    onClick={() =>
                      setIsCategoryPickerOpen((isOpen) => !isOpen)
                    }
                    aria-expanded={isCategoryPickerOpen}
                    aria-controls="transactionCategoryPicker"
                    disabled={matchingCategories.length === 0}
                    style={
                      {
                        '--category-color':
                          selectedCategory?.color ?? 'var(--border-strong)',
                      } as CSSProperties
                    }
                  >
                    {selectedCategory ? (
                      <span
                        className="wizard-category-icon"
                        style={{ backgroundColor: selectedCategory.color }}
                        aria-hidden="true"
                      >
                        {selectedCategory.icon || '•'}
                      </span>
                    ) : null}
                    <span className="wizard-category-select-text">
                      {selectedCategory?.name ?? 'Válassz kategóriát'}
                    </span>
                    <span className="wizard-category-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>

                  {matchingCategories.length === 0 ? (
                    <p className="wizard-category-empty" role="status">
                      Még nincs használható kategória.
                    </p>
                  ) : null}

                  {isCategoryPickerOpen ? (
                    <div
                      className="wizard-category-picker"
                      id="transactionCategoryPicker"
                    >
                      {matchingCategories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          className={
                            selectedCategoryId === category.id ? 'active' : ''
                          }
                          onClick={() => handleCategorySelect(category.id)}
                          aria-pressed={selectedCategoryId === category.id}
                          style={
                            {
                              '--category-color': category.color,
                            } as CSSProperties
                          }
                        >
                          <span
                            className="wizard-category-icon"
                            style={{ backgroundColor: category.color }}
                            aria-hidden="true"
                          >
                            {category.icon || '•'}
                          </span>
                          <span>{category.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
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
              </section>
            ) : null}

            {message ? (
              <p className={`message ${message.type}`} role="status">
                {message.text}
              </p>
            ) : null}
          </div>

          {step > 1 ? (
            <div className="wizard-footer">{renderPrimaryAction()}</div>
          ) : null}
        </form>
      </section>
    </div>
  )
}
