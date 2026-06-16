import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatHuf, toNumber } from '../lib/currency'
import {
  addMonths,
  formatPeriodLabel,
  formatHungarianMonth,
  getCurrentMonthRange,
  getCurrentLocalMonth,
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
  const [selectedMonth, setSelectedMonth] = useState(getCurrentLocalMonth)
  const [account, setAccount] = useState<CashAccount | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [isListLoading, setIsListLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionTypeFilter>('all')
  const [dateFromInput, setDateFromInput] = useState(initialMonthRange.firstDay)
  const [dateToInput, setDateToInput] = useState(initialMonthRange.lastDay)
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

  const periodHeading =
    dateFrom && dateTo && dateFrom.slice(0, 7) === dateTo.slice(0, 7)
      ? formatHungarianMonth(new Date(`${dateFrom}T00:00:00`))
      : formatPeriodLabel(dateFrom, dateTo)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setMessage(null)

    const { data: accountRows, error: accountError } = await supabase
      .from('cash_accounts')
      .select('*')
      .eq('user_id', userId)

    if (accountError) {
      setMessage({
        type: 'error',
        text: `Nem sikerült betölteni a pénztárat: ${accountError.message}`,
      })
      setAccount(null)
      setCategories([])
      setTransactions([])
      setFilteredTransactions([])
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
      setFilteredTransactions([])
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
      setFilteredTransactions([])
      setIsLoading(false)
      return
    }

    setAccount(defaultAccount)
    setCategories((categoryRows ?? []) as Category[])
    setTransactions((transactionRows ?? []) as Transaction[])
    setIsLoading(false)
  }, [userId])

  const loadFilteredTransactions = useCallback(
    async (currentAccount: CashAccount) => {
      if (!dateFrom || !dateTo) {
        setFilteredTransactions([])
        setListError('Válassz érvényes időszakot a listához.')
        return
      }

      setIsListLoading(true)
      setListError(null)

      let query = supabase
        .from('transactions')
        .select('*, categories(*)')
        .eq('user_id', userId)
        .eq('account_id', currentAccount.id)
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (transactionFilter !== 'all') {
        query = query.eq('type', transactionFilter)
      }

      const { data, error } = await query

      if (error) {
        setFilteredTransactions([])
        setListError(`Nem sikerült betölteni a tranzakciókat: ${error.message}`)
        setIsListLoading(false)
        return
      }

      setFilteredTransactions((data ?? []) as Transaction[])
      setIsListLoading(false)
    },
    [dateFrom, dateTo, transactionFilter, userId],
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadDashboard])

  useEffect(() => {
    if (!account) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadFilteredTransactions(account)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [account, loadFilteredTransactions])

  const dashboardTotals = useMemo(() => {
    const monthRange = getMonthRange(selectedMonth)
    const openingBalance = toNumber(account?.opening_balance)

    return transactions.reduce(
      (totals, transaction) => {
        const amount = toNumber(transaction.amount)
        const signedAmount = transaction.type === 'income' ? amount : -amount
        const isInSelectedMonth =
          transaction.transaction_date >= monthRange.firstDay &&
          transaction.transaction_date <= monthRange.lastDay

        return {
          balance: totals.balance + signedAmount,
          monthlyIncome:
            isInSelectedMonth && transaction.type === 'income'
              ? totals.monthlyIncome + amount
              : totals.monthlyIncome,
          monthlyExpenses:
            isInSelectedMonth && transaction.type === 'expense'
              ? totals.monthlyExpenses + amount
              : totals.monthlyExpenses,
        }
      },
      {
        balance: openingBalance,
        monthlyIncome: 0,
        monthlyExpenses: 0,
      },
    )
  }, [account?.opening_balance, selectedMonth, transactions])

  const handleTransactionSaved = async () => {
    await loadDashboard()
    if (account) {
      await loadFilteredTransactions(account)
    }
    setMessage({
      type: 'success',
      text: 'A tranzakció mentése sikerült.',
    })
  }

  const handleTransactionUpdated = async (transaction: Transaction) => {
    await loadDashboard()
    if (account) {
      await loadFilteredTransactions(account)
    }
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
    if (account) {
      await loadFilteredTransactions(account)
    }
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
    const nextMonth = addMonths(selectedMonth, amount)
    const nextRange = getMonthRange(nextMonth)

    setSelectedMonth(nextMonth)
    setDateFromInput(nextRange.firstDay)
    setDateToInput(nextRange.lastDay)
    setDateFrom(nextRange.firstDay)
    setDateTo(nextRange.lastDay)
    setListError(null)
  }

  const handleApplyDateRange = () => {
    if (!dateFromInput || !dateToInput) {
      setListError('Add meg a kezdő és a záró dátumot.')
      return
    }

    if (dateFromInput > dateToInput) {
      setListError('A kezdő dátum nem lehet későbbi a záró dátumnál.')
      return
    }

    setDateFrom(dateFromInput)
    setDateTo(dateToInput)
    setSelectedMonth(
      new Date(`${dateFromInput}T00:00:00`),
    )
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
          <div className="panel-header">
            <div>
              <p className="eyebrow">ZsebFlow</p>
              <h1>ZsebFlow</h1>
            </div>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={onOpenProfile}
            >
              Profil
            </button>
          </div>
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
        <div className="panel-header">
          <div>
            <p className="eyebrow">ZsebFlow</p>
            <h1>Házipénztár</h1>
            <p className="subtle-text">
              {displayName} · {displayEmail}
            </p>
          </div>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={onOpenProfile}
          >
            Profil
          </button>
        </div>

        <div className="dashboard-actions">
          <div className="month-selector" aria-label="Kiválasztott hónap">
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
            <strong>{periodHeading}</strong>
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
            <strong>{formatHuf(dashboardTotals.monthlyIncome)}</strong>
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
            <strong>{formatHuf(dashboardTotals.monthlyExpenses)}</strong>
          </button>
          <article className="metric-card">
            <span>Havi különbség</span>
            <strong>
              {formatHuf(
                dashboardTotals.monthlyIncome -
                  dashboardTotals.monthlyExpenses,
              )}
            </strong>
          </article>
        </div>

        <section className="transaction-section">
          <TransactionList
            title={listTitle}
            transactions={filteredTransactions}
            isLoading={isListLoading}
            error={listError}
            dateFrom={dateFrom}
            dateTo={dateTo}
            dateFromInput={dateFromInput}
            dateToInput={dateToInput}
            isExporting={isExporting}
            onSelect={(transaction) => {
              setSelectedTransaction(transaction)
              setIsEditOpen(false)
            }}
            onDateFromChange={setDateFromInput}
            onDateToChange={setDateToInput}
            onApplyDateRange={handleApplyDateRange}
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
