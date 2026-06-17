import { formatActivePeriodLabel } from '../lib/date'
import type {
  Transaction,
  TransactionTypeFilter,
} from '../types/finance'
import { CompactDateRange } from './CompactDateRange'
import { FinancialSummaryCard } from './FinancialSummaryCard'
import { RecentTransactionList } from './RecentTransactionList'

type DashboardTotals = {
  balance: number
  rangeIncome: number
  rangeExpenses: number
}

type HomeDashboardProps = {
  displayName: string
  displayEmail: string
  accountName: string
  activePeriodHeading: string
  dateFrom: string
  dateTo: string
  totals: DashboardTotals
  transactions: Transaction[]
  transactionFilter: TransactionTypeFilter
  listError: string | null
  isExporting: boolean
  onOpenProfile: () => void
  onNewTransaction: () => void
  onMonthChange: (amount: number) => void
  onSummaryFilter: (filter: Exclude<TransactionTypeFilter, 'all'>) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onExport: () => void
  onSelectTransaction: (transaction: Transaction) => void
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path
        d="M19.5 20.2a7.5 7.5 0 0 0-15 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M12 12a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

export function HomeDashboard({
  displayName,
  displayEmail,
  accountName,
  activePeriodHeading,
  dateFrom,
  dateTo,
  totals,
  transactions,
  transactionFilter,
  listError,
  isExporting,
  onOpenProfile,
  onNewTransaction,
  onMonthChange,
  onSummaryFilter,
  onDateFromChange,
  onDateToChange,
  onExport,
  onSelectTransaction,
}: HomeDashboardProps) {
  return (
    <div className="home-dashboard">
      <header className="home-header">
        <div className="home-header__copy">
          <h1>ZsebFlow</h1>
          <p>{displayName || displayEmail}</p>
        </div>
        <button
          className="home-profile-button"
          type="button"
          aria-label="Profil megnyitása"
          onClick={onOpenProfile}
        >
          <UserIcon />
        </button>
      </header>

      <section className="period-strip" aria-label="Kiválasztott időszak">
        <button
          className="period-arrow"
          type="button"
          aria-label="Előző hónap"
          onClick={() => onMonthChange(-1)}
        >
          ‹
        </button>
        <div>
          <span>Időszak</span>
          <strong>{activePeriodHeading}</strong>
        </div>
        <button
          className="period-arrow"
          type="button"
          aria-label="Következő hónap"
          onClick={() => onMonthChange(1)}
        >
          ›
        </button>
      </section>

      <FinancialSummaryCard
        balance={totals.balance}
        income={totals.rangeIncome}
        expenses={totals.rangeExpenses}
        accountName={accountName}
        periodLabel={formatActivePeriodLabel(dateFrom, dateTo)}
        activeFilter={transactionFilter}
        onFilterChange={onSummaryFilter}
      />

      <div className="home-primary-actions">
        <button className="primary-button" type="button" onClick={onNewTransaction}>
          Új tétel
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exportálás...' : 'XLSX export'}
        </button>
      </div>

      <section className="home-filter-card" id="reports-section">
        <div className="home-section-heading">
          <div>
            <span>Riportok</span>
            <h2>Dátumtartomány</h2>
          </div>
        </div>
        <CompactDateRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
        />
      </section>

      <RecentTransactionList
        transactions={transactions}
        error={listError}
        onSelect={onSelectTransaction}
      />
    </div>
  )
}
