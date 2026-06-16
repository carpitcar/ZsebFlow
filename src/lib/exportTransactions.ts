import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { toNumber } from './currency'
import { formatPeriodLabel } from './date'
import type { Transaction } from '../types/finance'

type ExportTransactionsOptions = {
  transactions: Transaction[]
  dateFrom: string
  dateTo: string
}

const parseLocalDate = (dateValue: string) => new Date(`${dateValue}T00:00:00`)

const currencyFormat = '# ##0" Ft";-# ##0" Ft"'

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
    { header: 'Összeg', key: 'amount', width: 16 },
  ]

  transactionSheet.views = [{ state: 'frozen', ySplit: 1 }]
  transactionSheet.autoFilter = {
    from: 'A1',
    to: 'F1',
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

    const row = transactionSheet.addRow({
      date: parseLocalDate(transaction.transaction_date),
      type: transaction.type === 'income' ? 'Bevétel' : 'Kiadás',
      category: transaction.categories?.name ?? 'Kategória nélkül',
      merchant: transaction.merchant_name ?? '',
      note: transaction.note ?? '',
      amount: signedAmount,
    })

    row.getCell('date').numFmt = 'yyyy. mm. dd.'
    row.getCell('amount').numFmt = currencyFormat
  })

  const summarySheet = workbook.addWorksheet('Összesítő')
  const totalIncome = transactions.reduce(
    (total, transaction) =>
      transaction.type === 'income'
        ? total + toNumber(transaction.amount)
        : total,
    0,
  )
  const totalExpense = transactions.reduce(
    (total, transaction) =>
      transaction.type === 'expense'
        ? total + toNumber(transaction.amount)
        : total,
    0,
  )

  summarySheet.columns = [
    { key: 'label', width: 28 },
    { key: 'value', width: 24 },
    { key: 'extra', width: 22 },
    { key: 'count', width: 18 },
  ]

  summarySheet.addRow(['Időszak', formatPeriodLabel(dateFrom, dateTo)])
  summarySheet.addRow(['Összes bevétel', totalIncome])
  summarySheet.addRow(['Összes kiadás', totalExpense])
  summarySheet.addRow(['Nettó különbség', totalIncome - totalExpense])
  summarySheet.addRow(['Tranzakciók száma', transactions.length])
  summarySheet.addRow([])
  summarySheet.addRow(['Kategória', 'Típus', 'Összeg', 'Tranzakciók száma'])

  for (const rowNumber of [1, 2, 3, 4, 5, 7]) {
    summarySheet.getRow(rowNumber).font = { bold: true }
  }

  for (const rowNumber of [2, 3, 4]) {
    summarySheet.getRow(rowNumber).getCell(2).numFmt = currencyFormat
  }

  const categorySummary = new Map<
    string,
    {
      category: string
      type: string
      amount: number
      count: number
    }
  >()

  transactions.forEach((transaction) => {
    const typeLabel = transaction.type === 'income' ? 'Bevétel' : 'Kiadás'
    const categoryName = transaction.categories?.name ?? 'Kategória nélkül'
    const key = `${transaction.type}:${categoryName}`
    const currentSummary =
      categorySummary.get(key) ??
      {
        category: categoryName,
        type: typeLabel,
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
        summary.amount,
        summary.count,
      ])
      row.getCell(3).numFmt = currencyFormat
    })

  summarySheet.getRow(7).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  }
  summarySheet.views = [{ state: 'frozen', ySplit: 7 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const fileName = `ZsebFlow_${dateFrom}_${dateTo}.xlsx`

  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName,
  )
}
