import { useState } from 'react'
import { BrandHeader } from './BrandHeader'
import { MobileBottomNav } from './MobileBottomNav'

type LoyaltyCardsViewProps = {
  onOpenHome: () => void
  onOpenReports: () => void
  onOpenLists: () => void
  onOpenProfile: () => void
  onAddTransaction: () => void
}

function LoyaltyCardsIllustration() {
  return (
    <svg
      className="loyalty-empty-illustration"
      viewBox="0 0 96 72"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="18" y="16" width="58" height="38" rx="8" />
      <rect x="26" y="26" width="18" height="8" rx="3" />
      <path d="M29 44h2M36 44h2M43 44h2M50 44h2M57 44h2M64 44h2" />
      <path d="M70 14l2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" />
      <path d="M14 24v-3a9 9 0 0 1 9-9h42" />
    </svg>
  )
}

export function LoyaltyCardsView({
  onOpenHome,
  onOpenReports,
  onOpenLists,
  onOpenProfile,
  onAddTransaction,
}: LoyaltyCardsViewProps) {
  const [message, setMessage] = useState<string | null>(null)

  return (
    <main className="app-shell page-shell">
      <section className="loyalty-cards-panel">
        <header className="loyalty-cards-header">
          <BrandHeader section="Hűségkártyák" onHome={onOpenHome} />
        </header>

        <section className="loyalty-empty-state" aria-labelledby="loyaltyEmptyTitle">
          <LoyaltyCardsIllustration />
          <div>
            <h2 id="loyaltyEmptyTitle">Még nincs elmentett kártyád.</h2>
            <p>
              Itt tárolhatod majd a hűség-, klub- és pontgyűjtő kártyáidat.
            </p>
          </div>
          <button
            className="primary-button loyalty-empty-action"
            type="button"
            onClick={() => setMessage('Hamarosan')}
          >
            Első kártya hozzáadása
          </button>
          {message ? (
            <p className="message success" role="status">
              {message}
            </p>
          ) : null}
        </section>
      </section>

      <MobileBottomNav
        activeItem="home"
        onHome={onOpenHome}
        onReports={onOpenReports}
        onAdd={onAddTransaction}
        onLists={onOpenLists}
        onProfile={onOpenProfile}
      />
    </main>
  )
}
