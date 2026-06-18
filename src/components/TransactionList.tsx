import type { CSSProperties } from 'react'
import { formatCurrency, toNumber } from '../lib/currency'
import { formatActivePeriodLabel, formatHungarianDate } from '../lib/date'
import { normalizeCategoryColor } from '../lib/categoryColor'
import {
  getPaymentMethodLabel,
  paymentMethodFilterOptions,
  type PaymentMethodFilter,
  normalizePaymentMethod,
} from '../lib/paymentMethod'
import type { Transaction } from '../types/finance'
import { CompactDateRange } from './CompactDateRange'

type TransactionListProps = {
  title: string
  transactions: Transaction[]
  isLoading: boolean
  error: string | null
  dateFrom: string
  dateTo: string
  isExporting: boolean
  paymentMethodFilter?: PaymentMethodFilter
  onSelect: (transaction: Transaction) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onExport: () => void
  onPaymentMethodChange?: (value: PaymentMethodFilter) => void
}

function PaymentMethodIcon({
  paymentMethod,
}: {
  paymentMethod: PaymentMethodFilter
}) {
  if (paymentMethod === 'card') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="3.5" y="6" width="17" height="12" rx="2.2" fill="none" />
        <path d="M3.5 10.2h17" />
        <path d="M7 14h4" />
      </svg>
    )
  }

  if (paymentMethod === 'cash') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="4" y="7" width="16" height="10" rx="2" fill="none" />
        <path d="M7 10h4M13 14h4" />
        <path d="M7.2 17V7M16.8 17V7" />
      </svg>
    )
  }

  if (paymentMethod === 'revolut') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="7" y="3.8" width="10" height="16.4" rx="2" fill="none" />
        <path d="M10.2 6.8h3.6" />
        <path d="M10.4 10h2.3a1.9 1.9 0 0 1 0 3.8h-2.3" />
        <path d="M10.4 13.8 14 18" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 7h12v10H6z" fill="none" />
      <path d="M6 12h12" />
      <path d="M10 8.5 8 10.5l2 2" />
      <path d="M14 8.5l2 2-2 2" />
    </svg>
  )
}

export function TransactionList({
  title,
  transactions,
  isLoading,
  error,
  dateFrom,
  dateTo,
  isExporting,
  paymentMethodFilter = 'all',
  onSelect,
  onDateFromChange,
  onDateToChange,
  onExport,
  onPaymentMethodChange,
}: TransactionListProps) {
  return (
    <div className="transaction-list-panel">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <span>{formatActivePeriodLabel(dateFrom, dateTo)}</span>
        </div>
        <div className="transaction-header-actions">
          <details className="mobile-action-menu">
            <summary>Műveletek</summary>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={onExport}
              disabled={isExporting || isLoading}
            >
              {isExporting ? 'Exportálás...' : 'Exportálás XLSX'}
            </button>
          </details>
        </div>
      </div>

      <div className="filter-panel">
        <CompactDateRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
        />
        {onPaymentMethodChange ? (
          <label className="filter-select" htmlFor="paymentMethodFilter">
            Fizetési mód
            <select
              id="paymentMethodFilter"
              value={paymentMethodFilter}
              onChange={(event) =>
                onPaymentMethodChange(event.target.value as PaymentMethodFilter)
              }
            >
              {paymentMethodFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          className="secondary-button compact-button desktop-export-button inline-export-button"
          type="button"
          onClick={onExport}
          disabled={isExporting || isLoading}
        >
          {isExporting ? 'Exportálás...' : 'Exportálás XLSX'}
        </button>
      </div>

      {error ? (
        <p className="message error" role="status">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="empty-state">Tranzakciók betöltése...</p>
      ) : transactions.length === 0 ? (
        <p className="empty-state">Még nincs rögzített tranzakció.</p>
      ) : (
        <div className="transaction-list">
          {transactions.map((transaction) => {
            const category = transaction.categories
            const amount = toNumber(transaction.amount)
            const isIncome = transaction.type === 'income'
            const description =
              transaction.merchant_name?.trim() ||
              transaction.note?.trim() ||
              ''
            const categoryColor = normalizeCategoryColor(category?.color)
            const paymentMethod = normalizePaymentMethod(transaction.payment_method)

            return (
              <button
                key={transaction.id}
                className={`transaction-item ${
                  isIncome ? 'income' : 'expense'
                }`}
                type="button"
                style={
                  {
                    '--category-color': categoryColor,
                  } as CSSProperties
                }
                onClick={() => onSelect(transaction)}
              >
                <span className="transaction-kind" aria-hidden="true">
                  {isIncome ? '+' : '-'}
                </span>
                <span className="transaction-main">
                  <span className="transaction-title">
                    <span
                      className="category-icon"
                      aria-hidden="true"
                      style={{
                        backgroundColor: categoryColor,
                      }}
                    >
                      {category?.icon || '•'}
                    </span>
                    {category?.name || 'Kategória nélkül'}
                  </span>
                  <span className="transaction-meta">
                    {formatHungarianDate(transaction.transaction_date)}
                    {description ? ` · ${description}` : ''}
                    <span
                      className="transaction-payment-method"
                      aria-label={getPaymentMethodLabel(paymentMethod)}
                    >
                      <PaymentMethodIcon paymentMethod={paymentMethod} />
                    </span>
                  </span>
                </span>
                <span className="transaction-amount">
                  {isIncome ? '+' : '-'}
                  {formatCurrency(amount, transaction.currency)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
