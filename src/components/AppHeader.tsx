import { BrandHeader } from './BrandHeader'

type AppHeaderProps = {
  subtitle?: string
  onBack?: () => void
  onProfile?: () => void
  onBrandClick: () => void
}

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path
        d="M15 18l-6-6 6-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.25"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
      <path
        d="M20 21a8 8 0 0 0-16 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="7"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

export function AppHeader({
  subtitle,
  onBack,
  onProfile,
  onBrandClick,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__main">
        {onBack ? (
          <button
            className="icon-button app-header__back-button"
            type="button"
            aria-label="Vissza"
            onClick={onBack}
          >
            <ArrowLeftIcon />
          </button>
        ) : null}

        <div className="app-header__title-group">
          <BrandHeader onHome={onBrandClick} />
          {subtitle ? <p className="subtle-text">{subtitle}</p> : null}
        </div>

        {onProfile ? (
          <button
            className="icon-button app-header__profile-button"
            type="button"
            aria-label="Profil megnyitása"
            onClick={onProfile}
          >
            <UserIcon />
          </button>
        ) : null}
      </div>
    </header>
  )
}
