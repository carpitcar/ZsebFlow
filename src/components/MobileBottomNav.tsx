type MobileBottomNavItem = {
  id: 'home' | 'transactions' | 'reports' | 'profile'
  label: 'Home' | 'Tételek' | 'Riportok' | 'Profil'
  icon: 'home' | 'list' | 'chart' | 'user'
  onClick: () => void
}

type MobileBottomNavProps = {
  activeItem: MobileBottomNavItem['id']
  onHome: () => void
  onTransactions: () => void
  onAdd: () => void
  onReports: () => void
  onProfile: () => void
}

function NavIcon({ icon }: { icon: MobileBottomNavItem['icon'] }) {
  if (icon === 'home') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m4 10.8 8-6.3 8 6.3v8.7a1 1 0 0 1-1 1h-4.4v-5.7H9.4v5.7H5a1 1 0 0 1-1-1z" />
      </svg>
    )
  }

  if (icon === 'list') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7.2 6.4h12.1M7.2 12h12.1M7.2 17.6h12.1" />
        <path d="M4.6 6.4h.1M4.6 12h.1M4.6 17.6h.1" />
      </svg>
    )
  }

  if (icon === 'chart') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 19V5" />
        <path d="M5 19h14" />
        <path d="M8.4 15.4v-3.1M12 15.4V8.6M15.6 15.4v-5" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M19.5 20.2a7.5 7.5 0 0 0-15 0" />
      <path d="M12 12a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z" />
    </svg>
  )
}

export function MobileBottomNav({
  activeItem,
  onHome,
  onTransactions,
  onAdd,
  onReports,
  onProfile,
}: MobileBottomNavProps) {
  const items: MobileBottomNavItem[] = [
    { id: 'home', label: 'Home', icon: 'home', onClick: onHome },
    { id: 'transactions', label: 'Tételek', icon: 'list', onClick: onTransactions },
    { id: 'reports', label: 'Riportok', icon: 'chart', onClick: onReports },
    { id: 'profile', label: 'Profil', icon: 'user', onClick: onProfile },
  ]

  return (
    <nav className="mobile-bottom-nav" aria-label="Elsődleges navigáció">
      {items.slice(0, 2).map((item) => (
        <button
          key={item.id}
          className={activeItem === item.id ? 'active' : ''}
          type="button"
          aria-current={activeItem === item.id ? 'page' : undefined}
          onClick={item.onClick}
        >
          <NavIcon icon={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
      <button
        className="mobile-bottom-nav__add"
        type="button"
        aria-label="Új tétel"
        onClick={onAdd}
      >
        +
      </button>
      {items.slice(2).map((item) => (
        <button
          key={item.id}
          className={activeItem === item.id ? 'active' : ''}
          type="button"
          aria-current={activeItem === item.id ? 'page' : undefined}
          onClick={item.onClick}
        >
          <NavIcon icon={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
