import type { Transaction } from '../types/finance'
import {
  CategoryFilterBar,
  type CategoryFilterOption,
} from './CategoryFilterBar'
import { BrandHeader } from './BrandHeader'
import { MonthSwitcher } from './MonthSwitcher'
import { RecentTransactionList } from './RecentTransactionList'

type HomeDashboardProps = {
  activePeriodHeading: string
  categoryFilters: CategoryFilterOption[]
  activeCategoryId: string | null
  transactions: Transaction[]
  listError: string | null
  onMonthChange: (amount: number) => void
  onOpenHome: () => void
  onOpenCards: () => void
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
  onOpenHome,
  onOpenCards,
  onCategoryFilterChange,
  onSelectTransaction,
}: HomeDashboardProps) {
  return (
    <div className="home-dashboard">
      <header className="home-dashboard-header">
        <BrandHeader onHome={onOpenHome} />
        <button
          className="home-cards-button"
          type="button"
          aria-label="Hűségkártyák megnyitása"
          onClick={onOpenCards}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3.5" y="5.5" width="17" height="13" rx="3" />
            <path d="M7 10h10M7 14h1.5M11 14h1.5M15 14h2" />
          </svg>
          <span>Kártyák</span>
        </button>
      </header>

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
