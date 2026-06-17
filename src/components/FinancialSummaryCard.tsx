import { formatHuf } from '../lib/currency'
import type { TransactionTypeFilter } from '../types/finance'

type FinancialSummaryCardProps = {
  balance: number
  income: number
  expenses: number
  accountName: string
  periodLabel: string
  activeFilter: TransactionTypeFilter
  onFilterChange: (filter: Exclude<TransactionTypeFilter, 'all'>) => void
}

export function FinancialSummaryCard({
  balance,
  income,
  expenses,
  accountName,
  periodLabel,
  activeFilter,
  onFilterChange,
}: FinancialSummaryCardProps) {
  const net = income - expenses

  return (
    <section className="financial-summary-card" aria-label="Pénzügyi áttekintés">
      <div className="summary-card__topline">
        <span>{accountName}</span>
        <span>{periodLabel}</span>
      </div>

      <div className="summary-card__balance">
        <span>Aktuális egyenleg</span>
        <strong>{formatHuf(balance)}</strong>
      </div>

      <div className="summary-card__breakdown">
        <button
          className={activeFilter === 'income' ? 'active income' : 'income'}
          type="button"
          aria-pressed={activeFilter === 'income'}
          onClick={() => onFilterChange('income')}
        >
          <span>Bevétel</span>
          <strong>{formatHuf(income)}</strong>
        </button>
        <button
          className={activeFilter === 'expense' ? 'active expense' : 'expense'}
          type="button"
          aria-pressed={activeFilter === 'expense'}
          onClick={() => onFilterChange('expense')}
        >
          <span>Kiadás</span>
          <strong>{formatHuf(expenses)}</strong>
        </button>
        <div className={net >= 0 ? 'net positive' : 'net negative'}>
          <span>Különbözet</span>
          <strong>{formatHuf(net)}</strong>
        </div>
      </div>
    </section>
  )
}
