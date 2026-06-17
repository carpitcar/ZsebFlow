import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toNumber } from '../lib/currency'
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
import { HomeDashboard } from './HomeDashboard'
import { MobileBottomNav } from './MobileBottomNav'
import { TransactionDetails } from './TransactionDetails'
import { TransactionEditForm } from './TransactionEditForm'
import { TransactionForm } from './TransactionForm'

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

  const scrollToHomeSection = (sectionId?: string) => {
    if (!sectionId) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
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
        <HomeDashboard
          displayName={displayName}
          displayEmail={displayEmail}
          accountName={account.name || 'Házipénztár'}
          activePeriodHeading={activePeriodHeading}
          dateFrom={dateFrom}
          dateTo={dateTo}
          totals={dashboardTotals}
          transactions={filteredTransactions}
          transactionFilter={transactionFilter}
          listError={listError}
          isExporting={isExporting}
          onOpenProfile={onOpenProfile}
          onNewTransaction={() => setIsFormOpen(true)}
          onMonthChange={handleMonthChange}
          onSummaryFilter={handleSummaryFilter}
          onDateFromChange={handleDateFromChange}
          onDateToChange={handleDateToChange}
          onExport={() => void handleExport()}
          onSelectTransaction={(transaction) => {
            setSelectedTransaction(transaction)
            setIsEditOpen(false)
          }}
        />

        {message ? (
          <p className={`message ${message.type}`} role="status">
            {message.text}
          </p>
        ) : null}
      </section>

      <MobileBottomNav
        activeItem="home"
        onHome={() => scrollToHomeSection()}
        onTransactions={() => scrollToHomeSection('transactions-section')}
        onReports={() => scrollToHomeSection('reports-section')}
        onProfile={onOpenProfile}
      />

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
