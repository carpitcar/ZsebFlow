import { formatHuf, toNumber } from '../lib/currency'
import { formatHungarianDate } from '../lib/date'
import { normalizeCategoryColor } from '../lib/categoryColor'
import type { Transaction } from '../types/finance'

type TransactionDetailsProps = {
  transaction: Transaction
  isDeleting: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: (transaction: Transaction) => Promise<void>
}

export function TransactionDetails({
  transaction,
  isDeleting,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailsProps) {
  const isIncome = transaction.type === 'income'

  const handleDelete = () => {
    const isConfirmed = window.confirm(
      'Biztosan törlöd ezt a tranzakciót? Ezt a műveletet nem lehet visszavonni.',
    )

    if (isConfirmed) {
      void onDelete(transaction)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-panel details-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transactionDetailsTitle"
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tranzakció</p>
            <h2 id="transactionDetailsTitle">Részletek</h2>
          </div>
          <button className="secondary-button compact-button" type="button" onClick={onClose}>
            Bezárás
          </button>
        </div>

        <dl className="details-list">
          <div className="transaction-detail-row">
            <dt>Típus</dt>
            <dd>{isIncome ? 'Bevétel' : 'Kiadás'}</dd>
          </div>
          <div className="transaction-detail-row">
            <dt>Összeg</dt>
            <dd className={isIncome ? 'income-value' : 'expense-value'}>
              {isIncome ? '+' : '-'}
              {formatHuf(toNumber(transaction.amount))}
            </dd>
          </div>
          <div className="transaction-detail-row">
            <dt>Kategória</dt>
            <dd>
              <span className="detail-category-value">
                <span
                  className="detail-category-color"
                  aria-hidden="true"
                  style={{
                    backgroundColor: normalizeCategoryColor(
                      transaction.categories?.color,
                    ),
                  }}
                />
                <span>{transaction.categories?.name || 'Kategória nélkül'}</span>
              </span>
            </dd>
          </div>
          <div className="transaction-detail-row">
            <dt>Dátum</dt>
            <dd>{formatHungarianDate(transaction.transaction_date)}</dd>
          </div>
          <div className="transaction-detail-row">
            <dt>Partner vagy üzlet</dt>
            <dd>{transaction.merchant_name || 'Nincs megadva'}</dd>
          </div>
          <div className="transaction-detail-row">
            <dt>Megjegyzés</dt>
            <dd>{transaction.note || 'Nincs megadva'}</dd>
          </div>
        </dl>

        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={onEdit}>
            Tranzakció szerkesztése
          </button>
          <button
            className="secondary-button danger-button"
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Törlés...' : 'Tranzakció törlése'}
          </button>
        </div>
      </section>
    </div>
  )
}
