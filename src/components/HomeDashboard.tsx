import type { Transaction } from '../types/finance'
import {
  CategoryFilterBar,
  type CategoryFilterOption,
} from './CategoryFilterBar'
import { MonthSwitcher } from './MonthSwitcher'
import { RecentTransactionList } from './RecentTransactionList'

type HomeDashboardProps = {
  activePeriodHeading: string
  categoryFilters: CategoryFilterOption[]
  activeCategoryId: string | null
  transactions: Transaction[]
  listError: string | null
  onMonthChange: (amount: number) => void
  onCategoryFilterChange: (categoryId: string | null) => void
  onSelectTransaction: (transaction: Transaction) => void
}

export function HomeDashboard({
  activePeriodHeading,
  categoryFilters,
  activeCategoryId,
  transactions,
  listError,
  onMonthChange,
  onCategoryFilterChange,
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

      <CategoryFilterBar
        categories={categoryFilters}
        activeCategoryId={activeCategoryId}
        onChange={onCategoryFilterChange}
      />

      <RecentTransactionList
        transactions={transactions}
        error={listError}
        onSelect={onSelectTransaction}
      />
    </div>
  )
}
