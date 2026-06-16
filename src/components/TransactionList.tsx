import { formatHuf, toNumber } from '../lib/currency'
import { formatHungarianDate, formatPeriodLabel } from '../lib/date'
import type { Transaction } from '../types/finance'

type TransactionListProps = {
  title: string
  transactions: Transaction[]
  isLoading: boolean
  error: string | null
  dateFrom: string
  dateTo: string
  dateFromInput: string
  dateToInput: string
  isExporting: boolean
  onSelect: (transaction: Transaction) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onApplyDateRange: () => void
  onExport: () => void
}

export function TransactionList({
  title,
  transactions,
  isLoading,
  error,
  dateFrom,
  dateTo,
  dateFromInput,
  dateToInput,
  isExporting,
  onSelect,
  onDateFromChange,
  onDateToChange,
  onApplyDateRange,
  onExport,
}: TransactionListProps) {
  const isDateRangeInvalid =
    !dateFromInput || !dateToInput || dateFromInput > dateToInput
  const dateRangeError =
    dateFromInput && dateToInput && dateFromInput > dateToInput
      ? 'A kezdő dátum nem lehet későbbi a záró dátumnál.'
      : null

  return (
    <div className="transaction-list-panel">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <span>{formatPeriodLabel(dateFrom, dateTo)}</span>
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
        <label htmlFor="dateFrom">
          Tól
          <input
            id="dateFrom"
            type="date"
            value={dateFromInput}
            onChange={(event) => onDateFromChange(event.target.value)}
          />
        </label>
        <label htmlFor="dateTo">
          Ig
          <input
            id="dateTo"
            type="date"
            value={dateToInput}
            onChange={(event) => onDateToChange(event.target.value)}
          />
        </label>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={onApplyDateRange}
          disabled={isDateRangeInvalid || isLoading}
        >
          {isLoading ? 'Betöltés...' : 'Alkalmazás'}
        </button>
        <button
          className="secondary-button compact-button desktop-export-button inline-export-button"
          type="button"
          onClick={onExport}
          disabled={isExporting || isLoading}
        >
          {isExporting ? 'Exportálás...' : 'Exportálás XLSX'}
        </button>
      </div>

      {dateRangeError ? (
        <p className="message error" role="status">
          {dateRangeError}
        </p>
      ) : null}

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

            return (
              <button
                key={transaction.id}
                className={`transaction-item ${
                  isIncome ? 'income' : 'expense'
                }`}
                type="button"
                onClick={() => onSelect(transaction)}
              >
                <span className="transaction-kind" aria-hidden="true">
                  {isIncome ? '+' : '-'}
                </span>
                <span className="transaction-main">
                  <span className="transaction-title">
                    <span className="category-icon" aria-hidden="true">
                      {category?.icon || '•'}
                    </span>
                    {category?.name || 'Kategória nélkül'}
                  </span>
                  <span className="transaction-meta">
                    {formatHungarianDate(transaction.transaction_date)}
                    {description ? ` · ${description}` : ''}
                  </span>
                </span>
                <span className="transaction-amount">
                  {isIncome ? '+' : '-'}
                  {formatHuf(amount)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
