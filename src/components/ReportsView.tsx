import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { normalizeCategoryColor } from '../lib/categoryColor'
import {
  defaultCurrencyCode,
  formatCurrency,
  normalizeCurrencyCode,
  toNumber,
} from '../lib/currency'
import {
  formatHungarianDate,
  formatPeriodLabel,
  getCurrentMonthRange,
} from '../lib/date'
import { exportTransactionsXlsx } from '../lib/exportTransactions'
import { normalizePaymentMethod } from '../lib/paymentMethod'
import { supabase } from '../lib/supabase'
import {
  ensureInitialUserCurrencies,
  getActiveCurrencies,
  getDefaultCurrency,
} from '../lib/userCurrencies'
import type {
  CashAccount,
  Category,
  PaymentMethod,
  Transaction,
  UserCurrency,
} from '../types/finance'
import { MobileBottomNav } from './MobileBottomNav'
import { BrandHeader } from './BrandHeader'
import { DatePicker } from './DatePicker'
import { TransactionDetails } from './TransactionDetails'
import { TransactionEditForm } from './TransactionEditForm'
import { TransactionWizard } from './TransactionWizard'
import { TransactionList } from './TransactionList'

type ReportsViewProps = {
  userId: string
  onOpenHome: () => void
  onOpenLists: () => void
  onOpenProfile: () => void
}

type Message = {
  type: 'success' | 'error'
  text: string
}

type IncomeDestination = PaymentMethod

type IncomeDistributionItem = {
  destination: IncomeDestination
  label: string
  color: string
  amount: number
  count: number
  percentage: number
  startAngle: number
  endAngle: number
  midAngle: number
}

const selectDefaultAccount = (accounts: CashAccount[]) =>
  accounts.find((account) => account.is_active === true) ??
  accounts.find((account) => account.name === 'Házipénztár') ??
  accounts[0] ??
  null

const incomeDestinationLabels: Record<IncomeDestination, string> = {
  bank_transfer: 'Bankszámla',
  revolut: 'Revolut',
  cash: 'Készpénz',
  szep_card: 'SZÉP-kártya',
  card: 'Bankkártya',
  unknown: 'Nincs megadva',
}

const incomeDestinationColors: Record<IncomeDestination, string> = {
  bank_transfer: '#2563eb',
  revolut: '#06b6d4',
  cash: '#16a34a',
  szep_card: '#f59e0b',
  card: '#7c3aed',
  unknown: '#64748b',
}

const normalizeIncomeDestination = (
  paymentMethod: string | null | undefined,
): IncomeDestination => normalizePaymentMethod(paymentMethod)

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

const describeDonutSlice = (
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
) => {
  if (endAngle - startAngle >= 359.99) {
    const topOuter = polarToCartesian(centerX, centerY, outerRadius, 0)
    const bottomOuter = polarToCartesian(centerX, centerY, outerRadius, 180)
    const topInner = polarToCartesian(centerX, centerY, innerRadius, 0)
    const bottomInner = polarToCartesian(centerX, centerY, innerRadius, 180)

    return [
      `M ${topOuter.x} ${topOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${bottomOuter.x} ${bottomOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${topOuter.x} ${topOuter.y}`,
      `L ${topInner.x} ${topInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${bottomInner.x} ${bottomInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${topInner.x} ${topInner.y}`,
      'Z',
    ].join(' ')
  }

  const outerStart = polarToCartesian(centerX, centerY, outerRadius, endAngle)
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, startAngle)
  const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle)
  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ')
}

export function ReportsView({
  userId,
  onOpenHome,
  onOpenLists,
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
  const [activeSection, setActiveSection] =
    useState<'summary' | 'transactions'>('summary')
  const [selectedDestination, setSelectedDestination] =
    useState<IncomeDestination | null>(null)

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
        .select(
          'id, user_id, account_id, category_id, type, amount, currency, payment_method, transaction_date, merchant_name, note, created_at, categories(*)',
        )
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
    setTransactions((transactionRows ?? []) as unknown as Transaction[])
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

  const summaryTransactions = useMemo(() => {
    if (!selectedDestination) {
      return transactions
    }

    return transactions.filter(
      (transaction) =>
        normalizeIncomeDestination(transaction.payment_method) ===
        selectedDestination,
    )
  }, [selectedDestination, transactions])

  const summaryTotals = useMemo(
    () =>
      summaryTransactions.reduce(
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
    [summaryTransactions],
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

  const incomeDistribution = useMemo<IncomeDistributionItem[]>(() => {
    const distributionMap = new Map<
      IncomeDestination,
      { destination: IncomeDestination; label: string; color: string; amount: number; count: number }
    >()

    transactions.forEach((transaction) => {
      if (transaction.type !== 'income') {
        return
      }

      const destination = normalizeIncomeDestination(transaction.payment_method)
      const currentValue =
        distributionMap.get(destination) ??
        {
          destination,
          label: incomeDestinationLabels[destination],
          color: incomeDestinationColors[destination],
          amount: 0,
          count: 0,
        }

      distributionMap.set(destination, {
        ...currentValue,
        amount: currentValue.amount + toNumber(transaction.amount),
        count: currentValue.count + 1,
      })
    })

    const totalIncome = Array.from(distributionMap.values()).reduce(
      (sum, destination) => sum + destination.amount,
      0,
    )
    let progress = 0

    return Array.from(distributionMap.values())
      .sort(
        (firstDestination, secondDestination) =>
          secondDestination.amount - firstDestination.amount,
      )
      .map((destination) => {
        const percentage =
          totalIncome > 0 ? destination.amount / totalIncome : 0
        const startAngle = progress * 360
        const endAngle = startAngle + percentage * 360
        progress += percentage

        return {
          ...destination,
          percentage,
          startAngle,
          endAngle,
          midAngle: startAngle + (endAngle - startAngle) / 2,
        }
      })
  }, [transactions])

  useEffect(() => {
    if (
      selectedDestination &&
      !incomeDistribution.some(
        (destination) => destination.destination === selectedDestination,
      )
    ) {
      setSelectedDestination(null)
    }
  }, [incomeDistribution, selectedDestination])

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

  const handleDestinationToggle = (destination: IncomeDestination) => {
    setSelectedDestination((currentDestination) =>
      currentDestination === destination ? null : destination,
    )
  }

  const handleDestinationKeyDown = (
    event: KeyboardEvent<SVGPathElement>,
    destination: IncomeDestination,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    handleDestinationToggle(destination)
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
            <BrandHeader section="Riportok" onHome={onOpenHome} />
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
          <DatePicker
            id="reportDateFrom"
            label="Kezdő dátum"
            value={dateFrom}
            onChange={handleDateFromChange}
            max={dateTo}
          />
          <DatePicker
            id="reportDateTo"
            label="Záró dátum"
            value={dateTo}
            onChange={handleDateToChange}
            min={dateFrom}
          />
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

        <div className="report-tabs" aria-label="Riport nézet">
          <button
            className={activeSection === 'summary' ? 'active' : ''}
            type="button"
            onClick={() => setActiveSection('summary')}
          >
            Összesítés
          </button>
          <button
            className={activeSection === 'transactions' ? 'active' : ''}
            type="button"
            onClick={() => setActiveSection('transactions')}
          >
            Tételek
          </button>
        </div>

        {message ? (
          <p className={`message ${message.type}`} role="status">
            {message.text}
          </p>
        ) : null}

        {activeSection === 'transactions' ? (
          <TransactionList
            title="Tételek"
            transactions={transactions}
            isLoading={isLoading}
            error={message?.type === 'error' ? message.text : null}
            dateFrom={dateFrom}
            dateTo={dateTo}
            isExporting={isExporting}
            onSelect={(transaction) => {
              setSelectedTransaction(transaction)
              setIsEditOpen(false)
            }}
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
            onExport={handleExport}
          />
        ) : (
          <>
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

            <section className="report-summary-grid" aria-label="Összesítés">
              <article>
                <span>Bevétel</span>
                <strong>
                  {formatCurrency(summaryTotals.income, selectedCurrency)}
                </strong>
              </article>
              <article>
                <span>Kiadás</span>
                <strong>
                  {formatCurrency(summaryTotals.expense, selectedCurrency)}
                </strong>
              </article>
              <article>
                <span>Különbözet</span>
                <strong>
                  {formatCurrency(
                    summaryTotals.income - summaryTotals.expense,
                    selectedCurrency,
                  )}
                </strong>
              </article>
              <article>
                <span>Tételek</span>
                <strong>{summaryTransactions.length}</strong>
              </article>
            </section>

            <section className="report-card income-distribution-card">
              <div className="report-section-heading">
                <h2>Bevételek eloszlása</h2>
                {selectedDestination ? (
                  <button
                    className="compact-button secondary-button"
                    type="button"
                    onClick={() => setSelectedDestination(null)}
                  >
                    Összes
                  </button>
                ) : null}
              </div>
              {incomeDistribution.length === 0 ? (
                <p className="empty-state">
                  Nincs bevétel a kiválasztott időszakban.
                </p>
              ) : (
                <div className="income-distribution-layout">
                  <div className="income-donut-wrap">
                    <svg
                      className="income-donut-chart"
                      viewBox="0 0 180 180"
                      role="img"
                      aria-label="Bevételek eloszlása cél szerint"
                    >
                      {incomeDistribution.map((destination) => {
                        const isSelected =
                          destination.destination === selectedDestination
                        const offset = isSelected ? 6 : 0
                        const center = polarToCartesian(
                          90,
                          90,
                          offset,
                          destination.midAngle,
                        )
                        const outerRadius = isSelected ? 74 : 68

                        return (
                          <path
                            key={destination.destination}
                            className={`income-donut-slice${
                              isSelected ? ' selected' : ''
                            }`}
                            d={describeDonutSlice(
                              center.x,
                              center.y,
                              42,
                              outerRadius,
                              destination.startAngle,
                              destination.endAngle,
                            )}
                            fill={destination.color}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            aria-label={`${destination.label} bevételek kiválasztása`}
                            onClick={() =>
                              handleDestinationToggle(destination.destination)
                            }
                            onKeyDown={(event) =>
                              handleDestinationKeyDown(
                                event,
                                destination.destination,
                              )
                            }
                          />
                        )
                      })}
                    </svg>
                    <span>
                      {formatCurrency(totals.income, selectedCurrency)}
                    </span>
                  </div>
                  <div className="income-distribution-list">
                    {incomeDistribution.map((destination) => {
                      const isSelected =
                        destination.destination === selectedDestination

                      return (
                        <button
                          key={destination.destination}
                          className={isSelected ? 'selected' : ''}
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`${destination.label} bevételek kiválasztása`}
                          onClick={() =>
                            handleDestinationToggle(destination.destination)
                          }
                        >
                          <span
                            className="distribution-dot"
                            style={{ backgroundColor: destination.color }}
                            aria-hidden="true"
                          />
                          <strong>{destination.label}</strong>
                          <span>
                            {formatCurrency(destination.amount, selectedCurrency)}
                            {' · '}
                            {Math.round(destination.percentage * 100)}%
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
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
          </>
        )}
      </section>

      <MobileBottomNav
        activeItem="reports"
        onHome={onOpenHome}
        onReports={() => undefined}
        onAdd={() => setIsFormOpen(true)}
        onLists={onOpenLists}
        onProfile={onOpenProfile}
      />

      {isFormOpen && account ? (
        <TransactionWizard
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
