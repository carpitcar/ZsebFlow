import type { Transaction } from '../types/finance'
import { MonthSwitcher } from './MonthSwitcher'
import { RecentTransactionList } from './RecentTransactionList'

type HomeDashboardProps = {
  activePeriodHeading: string
  transactions: Transaction[]
  listError: string | null
  onMonthChange: (amount: number) => void
  onSelectTransaction: (transaction: Transaction) => void
}

export function HomeDashboard({
  activePeriodHeading,
  transactions,
  listError,
  onMonthChange,
  onSelectTransaction,
}: HomeDashboardProps) {
  return (
    <div className="home-dashboard">
      <h1 className="home-brand-title">ZsebFlow</h1>

      <MonthSwitcher
        label={activePeriodHeading}
        onPrevious={() => onMonthChange(-1)}
        onNext={() => onMonthChange(1)}
      />

      <RecentTransactionList
        transactions={transactions}
        error={listError}
        onSelect={onSelectTransaction}
      />
    </div>
  )
}
