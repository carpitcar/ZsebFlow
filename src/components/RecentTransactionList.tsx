import { formatHuf, toNumber } from '../lib/currency'
import { formatHungarianDate } from '../lib/date'
import type { Transaction } from '../types/finance'

type RecentTransactionListProps = {
  transactions: Transaction[]
  error: string | null
  onSelect: (transaction: Transaction) => void
}

export function RecentTransactionList({
  transactions,
  error,
  onSelect,
}: RecentTransactionListProps) {
  return (
    <section className="recent-transactions-card" id="transactions-section">
      <div className="home-section-heading">
        <div>
          <span>Tételek</span>
          <h2>Legutóbbi mozgások</h2>
        </div>
        <small>{transactions.length} tétel</small>
      </div>

      {error ? (
        <p className="message error" role="status">
          {error}
        </p>
      ) : null}

      {transactions.length === 0 ? (
        <p className="empty-state">Még nincs rögzített tranzakció.</p>
      ) : (
        <div className="recent-transaction-list">
          {transactions.map((transaction) => {
            const category = transaction.categories
            const amount = toNumber(transaction.amount)
            const isIncome = transaction.type === 'income'
            const description =
              transaction.merchant_name?.trim() ||
              transaction.note?.trim() ||
              'Nincs megjegyzés'

            return (
              <button
                key={transaction.id}
                className={`recent-transaction-row ${
                  isIncome ? 'income' : 'expense'
                }`}
                type="button"
                onClick={() => onSelect(transaction)}
              >
                <span className="recent-transaction-icon" aria-hidden="true">
                  {category?.icon || (isIncome ? '+' : '-')}
                </span>
                <span className="recent-transaction-main">
                  <strong>{category?.name || 'Kategória nélkül'}</strong>
                  <span>{description}</span>
                </span>
                <span className="recent-transaction-side">
                  <strong>
                    {isIncome ? '+' : '-'}
                    {formatHuf(amount)}
                  </strong>
                  <span>{formatHungarianDate(transaction.transaction_date)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
