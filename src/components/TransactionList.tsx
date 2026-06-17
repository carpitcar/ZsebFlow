import type { CSSProperties } from 'react'
import { formatHuf, toNumber } from '../lib/currency'
import { formatActivePeriodLabel, formatHungarianDate } from '../lib/date'
import { normalizeCategoryColor } from '../lib/categoryColor'
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
  onSelect: (transaction: Transaction) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onExport: () => void
}

export function TransactionList({
  title,
  transactions,
  isLoading,
  error,
  dateFrom,
  dateTo,
  isExporting,
  onSelect,
  onDateFromChange,
  onDateToChange,
  onExport,
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
