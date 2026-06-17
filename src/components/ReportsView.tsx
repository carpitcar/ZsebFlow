import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { normalizeCategoryColor } from '../lib/categoryColor'
import {
  defaultCurrencyCode,
  formatCurrency,
  normalizeCurrencyCode,
  toNumber,
} from '../lib/currency'
import {
  formatCompactDate,
  formatHungarianDate,
  formatLocalDateInput,
  formatPeriodLabel,
  getCurrentMonthRange,
} from '../lib/date'
import { exportTransactionsXlsx } from '../lib/exportTransactions'
import { supabase } from '../lib/supabase'
import {
  ensureInitialUserCurrencies,
  getActiveCurrencies,
  getDefaultCurrency,
} from '../lib/userCurrencies'
import type {
  CashAccount,
  Category,
  Transaction,
  UserCurrency,
} from '../types/finance'
import { MobileBottomNav } from './MobileBottomNav'
import { TransactionDetails } from './TransactionDetails'
import { TransactionEditForm } from './TransactionEditForm'
import { TransactionForm } from './TransactionForm'

type ReportsViewProps = {
  userId: string
  onOpenHome: () => void
  onOpenProfile: () => void
}

type Message = {
  type: 'success' | 'error'
  text: string
}

type TrendBucket = {
  key: string
  label: string
  amount: number
}

const selectDefaultAccount = (accounts: CashAccount[]) =>
  accounts.find((account) => account.is_active === true) ??
  accounts.find((account) => account.name === 'Házipénztár') ??
  accounts[0] ??
  null

const parseLocalDate = (dateValue: string) => new Date(`${dateValue}T00:00:00`)

const getDayCount = (dateFrom: string, dateTo: string) => {
  const fromTime = parseLocalDate(dateFrom).getTime()
  const toTime = parseLocalDate(dateTo).getTime()

  return Math.max(1, Math.round((toTime - fromTime) / 86_400_000) + 1)
}

const getTrendLabel = (bucketType: 'daily' | 'weekly' | 'monthly') => {
  if (bucketType === 'daily') {
    return 'Napi költés'
  }

  if (bucketType === 'weekly') {
    return 'Heti költés'
  }

  return 'Havi költés'
}

const getTrendBuckets = (
  transactions: Transaction[],
  dateFrom: string,
  dateTo: string,
): { bucketType: 'daily' | 'weekly' | 'monthly'; buckets: TrendBucket[] } => {
  const dayCount = getDayCount(dateFrom, dateTo)
  const bucketType =
    dayCount <= 45 ? 'daily' : dayCount <= 180 ? 'weekly' : 'monthly'
  const bucketMap = new Map<string, TrendBucket>()
  const rangeStart = parseLocalDate(dateFrom)
  const rangeEnd = parseLocalDate(dateTo)

  if (bucketType === 'daily') {
    for (
      let date = new Date(rangeStart);
      date <= rangeEnd;
      date.setDate(date.getDate() + 1)
    ) {
      const key = formatLocalDateInput(date)
      bucketMap.set(key, {
        key,
        label: formatCompactDate(key),
        amount: 0,
      })
    }
  } else if (bucketType === 'weekly') {
    let bucketStart = new Date(rangeStart)
    let index = 1

    while (bucketStart <= rangeEnd) {
      const key = formatLocalDateInput(bucketStart)
      bucketMap.set(key, {
        key,
        label: `${index}. hét`,
        amount: 0,
      })
      bucketStart = new Date(
        bucketStart.getFullYear(),
        bucketStart.getMonth(),
        bucketStart.getDate() + 7,
      )
      index += 1
    }
  } else {
    for (
      let date = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      date <= rangeEnd;
      date.setMonth(date.getMonth() + 1)
    ) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        '0',
      )}`
      bucketMap.set(key, {
        key,
        label: new Intl.DateTimeFormat('hu-HU', {
          month: 'short',
          year: 'numeric',
        }).format(date),
        amount: 0,
      })
    }
  }

  transactions.forEach((transaction) => {
    if (transaction.type !== 'expense') {
      return
    }

    const transactionDate = parseLocalDate(transaction.transaction_date)
    let key: string

    if (bucketType === 'daily') {
      key = transaction.transaction_date
    } else if (bucketType === 'weekly') {
      const daysFromStart = Math.floor(
        (transactionDate.getTime() - rangeStart.getTime()) / 86_400_000,
      )
      const bucketStart = new Date(rangeStart)
      bucketStart.setDate(rangeStart.getDate() + Math.floor(daysFromStart / 7) * 7)
      key = formatLocalDateInput(bucketStart)
    } else {
      key = `${transactionDate.getFullYear()}-${String(
        transactionDate.getMonth() + 1,
      ).padStart(2, '0')}`
    }

    const bucket = bucketMap.get(key)

    if (bucket) {
      bucket.amount += toNumber(transaction.amount)
    }
  })

  return {
    bucketType,
    buckets: Array.from(bucketMap.values()),
  }
}

export function ReportsView({
  userId,
  onOpenHome,
  onOpenProfile,
}: ReportsViewProps) {
  const initialRange = getCurrentMonthRange()
  const loadRequestRef = useRef(0)
  const hasAppliedDefaultCurrencyRef = useRef(false)
  const [account, setAccount] = useState<CashAccount | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [currencies, setCurrencies] = useState<UserCurrency[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [dateFrom, setDateFrom] = useState(initialRange.firstDay)
  const [dateTo, setDateTo] = useState(initialRange.lastDay)
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrencyCode)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const loadReports = useCallback(async () => {
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
      setAccount(null)
      setCategories([])
      setTransactions([])
      setMessage({
        type: 'error',
        text: `Nem sikerült betölteni a pénztárat: ${accountError.message}`,
      })
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
        .eq('currency', selectedCurrency)
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    if (requestId !== loadRequestRef.current) {
      return
    }

    if (categoryError || transactionError) {
      setAccount(defaultAccount)
      setCategories([])
      setTransactions([])
      setMessage({
        type: 'error',
        text:
          categoryError?.message ??
          transactionError?.message ??
          'Nem sikerült betölteni a riport adatokat.',
      })
      setIsLoading(false)
      return
    }

    setAccount(defaultAccount)
    setCategories((categoryRows ?? []) as Category[])
    setTransactions((transactionRows ?? []) as Transaction[])
    setIsLoading(false)
  }, [dateFrom, dateTo, selectedCurrency, userId])

  const loadCurrencies = useCallback(async () => {
    const { data } = await ensureInitialUserCurrencies(userId)
    setCurrencies(data)

    const defaultCurrency =
      getDefaultCurrency(data)?.currency_code ?? defaultCurrencyCode

    if (!hasAppliedDefaultCurrencyRef.current) {
      hasAppliedDefaultCurrencyRef.current = true
      setSelectedCurrency(defaultCurrency)
      return
    }

    if (
      data.length > 0 &&
      !data.some((currency) => currency.currency_code === selectedCurrency)
    ) {
      setSelectedCurrency(defaultCurrency)
    }
  }, [selectedCurrency, userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReports()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadReports])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCurrencies()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCurrencies])

  const totals = useMemo(
    () =>
      transactions.reduce(
        (currentTotals, transaction) => {
          const amount = toNumber(transaction.amount)

          if (transaction.type === 'income') {
            currentTotals.income += amount
          } else {
            currentTotals.expense += amount
          }

          return currentTotals
        },
        { income: 0, expense: 0 },
      ),
    [transactions],
  )

  const expenseTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.type === 'expense'),
    [transactions],
  )

  const categoryDistribution = useMemo(() => {
    const distributionMap = new Map<
      string,
      { id: string; name: string; color: string; amount: number; count: number }
    >()

    expenseTransactions.forEach((transaction) => {
      const category = transaction.categories
      const id = category?.id ?? 'uncategorized'
      const currentValue =
        distributionMap.get(id) ??
        {
          id,
          name: category?.name ?? 'Kategória nélkül',
          color: normalizeCategoryColor(category?.color),
          amount: 0,
          count: 0,
        }

      distributionMap.set(id, {
        ...currentValue,
        amount: currentValue.amount + toNumber(transaction.amount),
        count: currentValue.count + 1,
      })
    })

    const totalExpense = totals.expense
    const sortedDistribution = Array.from(distributionMap.values()).sort(
      (firstCategory, secondCategory) =>
        secondCategory.amount - firstCategory.amount,
    )
    const mainCategories = sortedDistribution.filter(
      (category, index) =>
        index < 5 && (totalExpense === 0 || category.amount / totalExpense >= 0.03),
    )
    const otherCategories = sortedDistribution.filter(
      (category) =>
        !mainCategories.some((mainCategory) => mainCategory.id === category.id),
    )

    if (otherCategories.length === 0) {
      return mainCategories
    }

    return [
      ...mainCategories,
      {
        id: 'other',
        name: 'Egyéb',
        color: '#64748b',
        amount: otherCategories.reduce(
          (sum, category) => sum + category.amount,
          0,
        ),
        count: otherCategories.reduce((sum, category) => sum + category.count, 0),
      },
    ]
  }, [expenseTransactions, totals.expense])

  const trend = useMemo(
    () => getTrendBuckets(transactions, dateFrom, dateTo),
    [dateFrom, dateTo, transactions],
  )

  const largestExpenses = useMemo(
    () =>
      [...expenseTransactions]
        .sort(
          (firstTransaction, secondTransaction) =>
            toNumber(secondTransaction.amount) - toNumber(firstTransaction.amount),
        )
        .slice(0, 5),
    [expenseTransactions],
  )

  const donutBackground = useMemo(() => {
    if (totals.expense <= 0 || categoryDistribution.length === 0) {
      return 'var(--surface-strong)'
    }

    let progress = 0
    const stops = categoryDistribution.map((category) => {
      const start = progress
      progress += (category.amount / totals.expense) * 100
      return `${category.color} ${start}% ${progress}%`
    })

    return `conic-gradient(${stops.join(', ')})`
  }, [categoryDistribution, totals.expense])

  const maxTrendAmount = Math.max(
    ...trend.buckets.map((bucket) => bucket.amount),
    1,
  )
  const activeCurrencies = getActiveCurrencies(currencies)
  const defaultCurrency =
    getDefaultCurrency(currencies)?.currency_code ?? defaultCurrencyCode
  const currencyOptions =
    activeCurrencies.length > 0
      ? activeCurrencies
      : [
          {
            id: defaultCurrency,
            user_id: userId,
            currency_code: defaultCurrency,
            is_default: true,
            is_active: true,
          },
        ]

  const handleDateFromChange = (value: string) => {
    if (!value) {
      return
    }

    setDateFrom(value)
    if (value > dateTo) {
      setDateTo(value)
    }
  }

  const handleDateToChange = (value: string) => {
    if (!value) {
      return
    }

    setDateTo(value)
    if (value < dateFrom) {
      setDateFrom(value)
    }
  }

  const handleExport = async () => {
    if (isExporting) {
      return
    }

    setIsExporting(true)

    try {
      await exportTransactionsXlsx({ transactions, dateFrom, dateTo })
    } catch {
      setMessage({
        type: 'error',
        text: 'Nem sikerült elkészíteni az XLSX exportot.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleTransactionSaved = async () => {
    await loadReports()
    setMessage({
      type: 'success',
      text: 'A tranzakció mentése sikerült.',
    })
  }

  const handleTransactionUpdated = async (transaction: Transaction) => {
    await loadReports()
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
    await loadReports()
    setMessage({
      type: 'success',
      text: 'A tranzakció törlése sikerült.',
    })
    setIsDeleting(false)
  }

  return (
    <main className="app-shell page-shell">
      <section className="reports-panel">
        <header className="reports-header">
          <div>
            <h1>Riportok</h1>
            <p>{formatPeriodLabel(dateFrom, dateTo)}</p>
          </div>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || isLoading}
          >
            {isExporting ? 'Exportálás...' : 'XLSX'}
          </button>
        </header>

        <section className="report-range-card" aria-label="Riport időszak">
          <label htmlFor="reportDateFrom">
            Kezdő dátum
            <input
              id="reportDateFrom"
              type="date"
              value={dateFrom}
              onChange={(event) => handleDateFromChange(event.target.value)}
            />
          </label>
          <label htmlFor="reportDateTo">
            Záró dátum
            <input
              id="reportDateTo"
              type="date"
              value={dateTo}
              onChange={(event) => handleDateToChange(event.target.value)}
            />
          </label>
          <label htmlFor="reportCurrency">
            Pénznem
            <select
              id="reportCurrency"
              value={selectedCurrency}
              onChange={(event) =>
                setSelectedCurrency(normalizeCurrencyCode(event.target.value))
              }
            >
              {currencyOptions.map((currency) => (
                <option key={currency.id} value={currency.currency_code}>
                  {currency.currency_code}
                </option>
              ))}
            </select>
          </label>
        </section>

        {message ? (
          <p className={`message ${message.type}`} role="status">
            {message.text}
          </p>
        ) : null}

        <section className="report-summary-grid" aria-label="Összesítés">
          <article>
            <span>Bevétel</span>
            <strong>{formatCurrency(totals.income, selectedCurrency)}</strong>
          </article>
          <article>
            <span>Kiadás</span>
            <strong>{formatCurrency(totals.expense, selectedCurrency)}</strong>
          </article>
          <article>
            <span>Különbözet</span>
            <strong>
              {formatCurrency(totals.income - totals.expense, selectedCurrency)}
            </strong>
          </article>
          <article>
            <span>Tételek</span>
            <strong>{transactions.length}</strong>
          </article>
        </section>

        {isLoading ? (
          <p className="empty-state">Riport betöltése...</p>
        ) : (
          <>
            <section className="report-card distribution-card">
              <div className="report-section-heading">
                <h2>Kiadások kategóriák szerint</h2>
              </div>
              {categoryDistribution.length === 0 ? (
                <p className="empty-state">Nincs kiadás a kiválasztott időszakban.</p>
              ) : (
                <div className="distribution-layout">
                  <div
                    className="donut-chart"
                    style={{ background: donutBackground }}
                    aria-hidden="true"
                  >
                    <span>{formatCurrency(totals.expense, selectedCurrency)}</span>
                  </div>
                  <div className="distribution-list">
                    {categoryDistribution.map((category) => (
                      <div key={category.id}>
                        <span
                          className="distribution-dot"
                          style={{ backgroundColor: category.color }}
                          aria-hidden="true"
                        />
                        <strong>{category.name}</strong>
                        <span>
                          {formatCurrency(category.amount, selectedCurrency)} ·{' '}
                          {Math.round((category.amount / totals.expense) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="report-card">
              <div className="report-section-heading">
                <h2>{getTrendLabel(trend.bucketType)}</h2>
              </div>
              <div className="trend-chart">
                {trend.buckets.map((bucket) => (
                  <div className="trend-column" key={bucket.key}>
                    <span>{formatCurrency(bucket.amount, selectedCurrency)}</span>
                    <div>
                      <i
                        style={{
                          height: `${Math.max(
                            4,
                            (bucket.amount / maxTrendAmount) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <small>{bucket.label}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="report-card">
              <div className="report-section-heading">
                <h2>Legnagyobb kiadások</h2>
              </div>
              {largestExpenses.length === 0 ? (
                <p className="empty-state">Nincs kiadás a kiválasztott időszakban.</p>
              ) : (
                <div className="largest-expense-list">
                  {largestExpenses.map((transaction) => {
                    const category = transaction.categories
                    const categoryColor = normalizeCategoryColor(category?.color)

                    return (
                      <button
                        key={transaction.id}
                        type="button"
                        style={
                          {
                            '--category-color': categoryColor,
                          } as CSSProperties
                        }
                        onClick={() => {
                          setSelectedTransaction(transaction)
                          setIsEditOpen(false)
                        }}
                      >
                        <span
                          className="recent-transaction-icon"
                          aria-hidden="true"
                          style={{ backgroundColor: categoryColor }}
                        >
                          {category?.icon || '-'}
                        </span>
                        <span>
                          <strong>{category?.name || 'Kategória nélkül'}</strong>
                          <small>{formatHungarianDate(transaction.transaction_date)}</small>
                        </span>
                        <b>
                          -{formatCurrency(
                            toNumber(transaction.amount),
                            selectedCurrency,
                          )}
                        </b>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <MobileBottomNav
        activeItem="reports"
        onHome={onOpenHome}
        onTransactions={onOpenHome}
        onAdd={() => setIsFormOpen(true)}
        onReports={() => undefined}
        onProfile={onOpenProfile}
      />

      {isFormOpen && account ? (
        <TransactionForm
          userId={userId}
          account={account}
          categories={categories}
          activeCurrencies={activeCurrencies}
          defaultCurrency={defaultCurrency}
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
          activeCurrencies={activeCurrencies}
          onClose={() => setIsEditOpen(false)}
          onSaved={handleTransactionUpdated}
        />
      ) : null}
    </main>
  )
}
