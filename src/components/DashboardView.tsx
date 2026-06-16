import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatHuf, toNumber } from '../lib/currency'
import {
  addMonths,
  formatActivePeriodLabel,
  getCurrentMonthRange,
  getMonthRange,
} from '../lib/date'
import { exportTransactionsXlsx } from '../lib/exportTransactions'
import { supabase } from '../lib/supabase'
import type {
  CashAccount,
  Category,
  Transaction,
  TransactionTypeFilter,
} from '../types/finance'
import { AppHeader } from './AppHeader'
import { TransactionDetails } from './TransactionDetails'
import { TransactionEditForm } from './TransactionEditForm'
import { TransactionForm } from './TransactionForm'
import { TransactionList } from './TransactionList'

type Message = {
  type: 'success' | 'error'
  text: string
}

type DashboardViewProps = {
  userId: string
  displayName: string
  displayEmail: string
  onOpenProfile: () => void
  onLogout: () => Promise<void>
  isLoggingOut: boolean
}

const selectDefaultAccount = (accounts: CashAccount[]) =>
  accounts.find((account) => account.is_active === true) ??
  accounts.find((account) => account.name === 'Házipénztár') ??
  accounts[0] ??
  null

export function DashboardView({
  userId,
  displayName,
  displayEmail,
  onOpenProfile,
  onLogout,
  isLoggingOut,
}: DashboardViewProps) {
  const initialMonthRange = getCurrentMonthRange()
  const loadRequestRef = useRef(0)
  const [account, setAccount] = useState<CashAccount | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionTypeFilter>('all')
  const [dateFrom, setDateFrom] = useState(initialMonthRange.firstDay)
  const [dateTo, setDateTo] = useState(initialMonthRange.lastDay)
  const [listError, setListError] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)

  const listTitle =
    transactionFilter === 'income'
      ? 'Bevételek'
      : transactionFilter === 'expense'
        ? 'Kiadások'
        : 'Tranzakciók'

  const activePeriodHeading = formatActivePeriodLabel(dateFrom, dateTo)

  const activeRangeTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_date >= dateFrom &&
          transaction.transaction_date <= dateTo,
      ),
    [dateFrom, dateTo, transactions],
  )

  const filteredTransactions = useMemo(
    () =>
      activeRangeTransactions.filter(
        (transaction) =>
          transactionFilter === 'all' ||
          transaction.type === transactionFilter,
      ),
    [activeRangeTransactions, transactionFilter],
  )

  const loadDashboard = useCallback(async () => {
    const requestId = ++loadRequestRef.current
    setIsLoading(true)
    setMessage(null)

    const { data: accountRows, error: accountError } = await supabase
      .from('cash_accounts')
      .select('*')
      .eq('user_id', userId)

    if (requestId !== loadRequestRef.current) {
      return
    }

    if (accountError) {
      setMessage({
        type: 'error',
        text: `Nem sikerült betölteni a pénztárat: ${accountError.message}`,
      })
      setAccount(null)
      setCategories([])
      setTransactions([])
      setIsLoading(false)
      return
    }

    const defaultAccount = selectDefaultAccount(
      (accountRows ?? []) as CashAccount[],
    )

    if (!defaultAccount) {
      setAccount(null)
      setCategories([])
      setTransactions([])
      setIsLoading(false)
      return
    }

    const [
      { data: categoryRows, error: categoryError },
      { data: transactionRows, error: transactionError },
    ] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true }),
      supabase
        .from('transactions')
        .select('*, categories(*)')
        .eq('user_id', userId)
        .eq('account_id', defaultAccount.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    if (requestId !== loadRequestRef.current) {
      return
    }

    if (categoryError || transactionError) {
      setMessage({
        type: 'error',
        text:
          categoryError?.message ??
          transactionError?.message ??
          'Nem sikerült betölteni az adatokat.',
      })
      setAccount(defaultAccount)
      setCategories([])
      setTransactions([])
      setIsLoading(false)
      return
    }

    setAccount(defaultAccount)
    setCategories((categoryRows ?? []) as Category[])
    setTransactions((transactionRows ?? []) as Transaction[])
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadDashboard])

  const dashboardTotals = useMemo(() => {
    const openingBalance = toNumber(account?.opening_balance)

    return transactions.reduce(
      (totals, transaction) => {
        const amount = toNumber(transaction.amount)
        const signedAmount = transaction.type === 'income' ? amount : -amount
        const isInActiveRange =
          transaction.transaction_date >= dateFrom &&
          transaction.transaction_date <= dateTo

        return {
          balance: totals.balance + signedAmount,
          rangeIncome:
            isInActiveRange && transaction.type === 'income'
              ? totals.rangeIncome + amount
              : totals.rangeIncome,
          rangeExpenses:
            isInActiveRange && transaction.type === 'expense'
              ? totals.rangeExpenses + amount
              : totals.rangeExpenses,
        }
      },
      {
        balance: openingBalance,
        rangeIncome: 0,
        rangeExpenses: 0,
      },
    )
  }, [account?.opening_balance, dateFrom, dateTo, transactions])

  const handleTransactionSaved = async () => {
    await loadDashboard()
    setMessage({
      type: 'success',
      text: 'A tranzakció mentése sikerült.',
    })
  }

  const handleTransactionUpdated = async (transaction: Transaction) => {
    await loadDashboard()
    setSelectedTransaction(transaction)
    setIsEditOpen(false)
    setMessage({
      type: 'success',
      text: 'A tranzakció módosítása sikerült.',
    })
  }

  const handleDelete = async (transaction: Transaction) => {
    setIsDeleting(true)
    setMessage(null)

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transaction.id)
      .eq('user_id', userId)

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült törölni a tranzakciót: ${error.message}`,
      })
      setIsDeleting(false)
      return
    }

    setSelectedTransaction(null)
    setIsEditOpen(false)
    await loadDashboard()
    setMessage({
      type: 'success',
      text: 'A tranzakció törlése sikerült.',
    })
    setIsDeleting(false)
  }

  const handleSummaryFilter = (filter: Exclude<TransactionTypeFilter, 'all'>) => {
    const nextFilter = transactionFilter === filter ? 'all' : filter

    setTransactionFilter(nextFilter)
    setListError(null)
  }

  const handleMonthChange = (amount: number) => {
    // The month navigation intentionally resets the active range to the
    // previous or next full calendar month, even if the current range spans
    // multiple months.
    const nextMonth = addMonths(new Date(`${dateFrom}T00:00:00`), amount)
    const nextRange = getMonthRange(nextMonth)

    setDateFrom(nextRange.firstDay)
    setDateTo(nextRange.lastDay)
    setListError(null)
  }

  const handleDateFromChange = (value: string) => {
    if (!value) {
      return
    }

    setDateFrom(value)
    if (dateTo && value > dateTo) {
      setDateTo(value)
    }
    setListError(null)
  }

  const handleDateToChange = (value: string) => {
    if (!value) {
      return
    }

    setDateTo(value)
    if (dateFrom && value < dateFrom) {
      setDateFrom(value)
    }
    setListError(null)
  }

  const handleExport = async () => {
    if (isExporting) {
      return
    }

    if (!dateFrom || !dateTo) {
      setListError('Válassz érvényes időszakot az exportáláshoz.')
      return
    }

    setIsExporting(true)
    setListError(null)

    try {
      await exportTransactionsXlsx({
        transactions: filteredTransactions,
        dateFrom,
        dateTo,
      })
    } catch {
      setListError('Nem sikerült elkészíteni az XLSX exportot.')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="app-shell page-shell">
        <section className="dashboard-panel" aria-live="polite">
          <p className="eyebrow">ZsebFlow</p>
          <h1>Betöltés...</h1>
          <p>A házipénztár adatai betöltés alatt.</p>
        </section>
      </main>
    )
  }

  if (!account) {
    return (
      <main className="app-shell page-shell">
        <section className="dashboard-panel">
          <AppHeader onProfile={onOpenProfile} />
          {message ? (
            <p className={`message ${message.type}`} role="status">
              {message.text}
            </p>
          ) : null}
          <p className="empty-state">
            Nem található aktív házipénztár ehhez a fiókhoz.
          </p>
          <button
            className="secondary-button danger-button"
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Kijelentkezés...' : 'Kijelentkezés'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell page-shell">
      <section className="dashboard-panel finance-dashboard">
        <AppHeader
          subtitle={`${displayName} · ${displayEmail}`}
          onProfile={onOpenProfile}
        />

        <div className="dashboard-actions">
          <div className="month-selector" aria-label="Kiválasztott időszak">
            <button
              className="secondary-button compact-button month-nav-button"
              type="button"
              aria-label="Előző hónap"
              onClick={() => handleMonthChange(-1)}
            >
              <span className="desktop-label">Előző hónap</span>
              <span className="mobile-label" aria-hidden="true">
                ‹
              </span>
            </button>
            <strong>{activePeriodHeading}</strong>
            <button
              className="secondary-button compact-button month-nav-button"
              type="button"
              aria-label="Következő hónap"
              onClick={() => handleMonthChange(1)}
            >
              <span className="desktop-label">Következő hónap</span>
              <span className="mobile-label" aria-hidden="true">
                ›
              </span>
            </button>
          </div>
          <button
            className="primary-button new-transaction-button"
            type="button"
            onClick={() => setIsFormOpen(true)}
          >
            <span className="desktop-label">Új tranzakció</span>
            <span className="mobile-label" aria-hidden="true">
              + Új
            </span>
          </button>
        </div>

        {message ? (
          <p className={`message ${message.type}`} role="status">
            {message.text}
          </p>
        ) : null}

        <div className="metric-grid">
          <article className="metric-card featured">
            <span>Aktuális egyenleg</span>
            <strong>{formatHuf(dashboardTotals.balance)}</strong>
            <small>{account.name || 'Házipénztár'}</small>
          </article>
          <button
            className={
              transactionFilter === 'income'
                ? 'metric-card clickable active income'
                : 'metric-card clickable income'
            }
            type="button"
            aria-pressed={transactionFilter === 'income'}
            onClick={() => handleSummaryFilter('income')}
          >
            <span>Havi bevétel</span>
            <strong>{formatHuf(dashboardTotals.rangeIncome)}</strong>
          </button>
          <button
            className={
              transactionFilter === 'expense'
                ? 'metric-card clickable active expense'
                : 'metric-card clickable expense'
            }
            type="button"
            aria-pressed={transactionFilter === 'expense'}
            onClick={() => handleSummaryFilter('expense')}
          >
            <span>Havi kiadás</span>
            <strong>{formatHuf(dashboardTotals.rangeExpenses)}</strong>
          </button>
          <article className="metric-card">
            <span>Havi különbség</span>
            <strong>
              {formatHuf(dashboardTotals.rangeIncome - dashboardTotals.rangeExpenses)}
            </strong>
          </article>
        </div>

        <section className="transaction-section">
          <TransactionList
            title={listTitle}
            transactions={filteredTransactions}
            isLoading={false}
            error={listError}
            dateFrom={dateFrom}
            dateTo={dateTo}
            isExporting={isExporting}
            onSelect={(transaction) => {
              setSelectedTransaction(transaction)
              setIsEditOpen(false)
            }}
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
            onExport={() => void handleExport()}
          />
        </section>
      </section>

      {isFormOpen ? (
        <TransactionForm
          userId={userId}
          account={account}
          categories={categories}
          onClose={() => setIsFormOpen(false)}
          onSaved={handleTransactionSaved}
        />
      ) : null}

      {selectedTransaction ? (
        <TransactionDetails
          transaction={selectedTransaction}
          isDeleting={isDeleting}
          onClose={() => {
            setSelectedTransaction(null)
            setIsEditOpen(false)
          }}
          onEdit={() => setIsEditOpen(true)}
          onDelete={handleDelete}
        />
      ) : null}

      {selectedTransaction && isEditOpen ? (
        <TransactionEditForm
          userId={userId}
          transaction={selectedTransaction}
          categories={categories}
          onClose={() => setIsEditOpen(false)}
          onSaved={handleTransactionUpdated}
        />
      ) : null}
    </main>
  )
}
