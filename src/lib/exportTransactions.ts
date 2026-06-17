import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { normalizeCurrencyCode, toNumber } from './currency'
import { formatPeriodLabel } from './date'
import { getPaymentMethodLabel, normalizePaymentMethod } from './paymentMethod'
import type { Transaction } from '../types/finance'

type ExportTransactionsOptions = {
  transactions: Transaction[]
  dateFrom: string
  dateTo: string
}

const parseLocalDate = (dateValue: string) => new Date(`${dateValue}T00:00:00`)

const numberFormat = '# ##0.00;-# ##0.00'

export async function exportTransactionsXlsx({
  transactions,
  dateFrom,
  dateTo,
}: ExportTransactionsOptions) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ZsebFlow'
  workbook.created = new Date()

  const transactionSheet = workbook.addWorksheet('Tranzakciók')
  transactionSheet.columns = [
    { header: 'Dátum', key: 'date', width: 14 },
    { header: 'Típus', key: 'type', width: 12 },
    { header: 'Kategória', key: 'category', width: 24 },
    { header: 'Partner / üzlet', key: 'merchant', width: 26 },
    { header: 'Megjegyzés', key: 'note', width: 34 },
    { header: 'Fizetési mód', key: 'paymentMethod', width: 18 },
    { header: 'Pénznem', key: 'currency', width: 12 },
    { header: 'Összeg', key: 'amount', width: 16 },
  ]

  transactionSheet.views = [{ state: 'frozen', ySplit: 1 }]
  transactionSheet.autoFilter = {
    from: 'A1',
    to: 'H1',
  }

  const headerRow = transactionSheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' },
  }
  headerRow.alignment = { vertical: 'middle' }

  transactions.forEach((transaction) => {
    const amount = toNumber(transaction.amount)
    const signedAmount = transaction.type === 'income' ? amount : -amount
    const currencyCode = normalizeCurrencyCode(transaction.currency)
    const paymentMethod = normalizePaymentMethod(transaction.payment_method)

    const row = transactionSheet.addRow({
      date: parseLocalDate(transaction.transaction_date),
      type: transaction.type === 'income' ? 'Bevétel' : 'Kiadás',
      category: transaction.categories?.name ?? 'Kategória nélkül',
      merchant: transaction.merchant_name ?? '',
      note: transaction.note ?? '',
      paymentMethod: getPaymentMethodLabel(paymentMethod),
      currency: currencyCode,
      amount: signedAmount,
    })

    row.getCell('date').numFmt = 'yyyy. mm. dd.'
    row.getCell('amount').numFmt = currencyCode === 'HUF' ? '# ##0' : numberFormat
  })

  const summarySheet = workbook.addWorksheet('Összesítő')
  const currencySummary = new Map(
    transactions.map((transaction) => [
      normalizeCurrencyCode(transaction.currency),
      { income: 0, expense: 0, count: 0 },
    ]),
  )
  transactions.forEach((transaction) => {
    const currencyCode = normalizeCurrencyCode(transaction.currency)
    const summary = currencySummary.get(currencyCode) ?? {
      income: 0,
      expense: 0,
      count: 0,
    }

    if (transaction.type === 'income') {
      summary.income += toNumber(transaction.amount)
    } else {
      summary.expense += toNumber(transaction.amount)
    }
    summary.count += 1
    currencySummary.set(currencyCode, summary)
  })

  summarySheet.columns = [
    { key: 'label', width: 28 },
    { key: 'value', width: 24 },
    { key: 'extra', width: 22 },
    { key: 'count', width: 18 },
  ]

  summarySheet.addRow(['Időszak', formatPeriodLabel(dateFrom, dateTo)])
  summarySheet.addRow(['Összesítés', 'Pénznem szerint'])
  summarySheet.addRow(['Tranzakciók száma', transactions.length])
  summarySheet.addRow([])
  summarySheet.addRow(['Pénznem', 'Bevétel', 'Kiadás', 'Különbözet', 'Tételek'])
  Array.from(currencySummary.entries())
    .sort(([leftCurrency], [rightCurrency]) =>
      leftCurrency.localeCompare(rightCurrency),
    )
    .forEach(([currencyCode, summary]) => {
      const row = summarySheet.addRow([
        currencyCode,
        summary.income,
        summary.expense,
        summary.income - summary.expense,
        summary.count,
      ])
      row.getCell(2).numFmt = currencyCode === 'HUF' ? '# ##0' : numberFormat
      row.getCell(3).numFmt = currencyCode === 'HUF' ? '# ##0' : numberFormat
      row.getCell(4).numFmt = currencyCode === 'HUF' ? '# ##0' : numberFormat
    })
  summarySheet.addRow([])
  summarySheet.addRow(['Kategória', 'Típus', 'Pénznem', 'Összeg', 'Tranzakciók száma'])

  for (const rowNumber of [1, 2, 3, 5]) {
    summarySheet.getRow(rowNumber).font = { bold: true }
  }

  const categorySummary = new Map<
    string,
    {
      category: string
      type: string
      currency: string
      amount: number
      count: number
    }
  >()

  transactions.forEach((transaction) => {
    const typeLabel = transaction.type === 'income' ? 'Bevétel' : 'Kiadás'
    const categoryName = transaction.categories?.name ?? 'Kategória nélkül'
    const currencyCode = normalizeCurrencyCode(transaction.currency)
    const key = `${transaction.type}:${currencyCode}:${categoryName}`
    const currentSummary =
      categorySummary.get(key) ??
      {
        category: categoryName,
        type: typeLabel,
        currency: currencyCode,
        amount: 0,
        count: 0,
      }
    const signedAmount =
      transaction.type === 'income'
        ? toNumber(transaction.amount)
        : -toNumber(transaction.amount)

    categorySummary.set(key, {
      ...currentSummary,
      amount: currentSummary.amount + signedAmount,
      count: currentSummary.count + 1,
    })
  })

  Array.from(categorySummary.values())
    .sort((left, right) =>
      `${left.type}-${left.category}`.localeCompare(
        `${right.type}-${right.category}`,
        'hu-HU',
      ),
    )
    .forEach((summary) => {
      const row = summarySheet.addRow([
        summary.category,
        summary.type,
        summary.currency,
        summary.amount,
        summary.count,
      ])
      row.getCell(4).numFmt = summary.currency === 'HUF' ? '# ##0' : numberFormat
    })

  summarySheet.views = [{ state: 'frozen', ySplit: 5 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const fileName = `ZsebFlow_${dateFrom}_${dateTo}.xlsx`

  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName,
  )
}
