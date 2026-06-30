import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  defaultCurrencyCode,
  isValidCurrencyCode,
  normalizeCurrencyCode,
} from '../lib/currency'
import { supabase } from '../lib/supabase'
import { ensureInitialUserCurrencies, getDefaultCurrency } from '../lib/userCurrencies'
import type { AccentOption, ThemeOption } from '../types/appearance'
import type { UserCurrency } from '../types/finance'
import { BrandHeader } from './BrandHeader'
import { CategoryManager } from './CategoryManager'

type Option<TValue extends string> = {
  value: TValue
  label: string
}

type Message = {
  type: 'success' | 'error'
  text: string
}

type ProfileViewProps = {
  userId: string
  email: string
  fullName: string
  theme: ThemeOption
  accent: AccentOption
  themeOptions: readonly Option<ThemeOption>[]
  accentOptions: readonly Option<AccentOption>[]
  onThemeChange: (theme: ThemeOption) => void
  onAccentChange: (accent: AccentOption) => void
  onFullNameSaved: (fullName: string) => void
  onBack: () => void
  onLogout: () => Promise<void>
  isLoggingOut: boolean
}

type SettingsSectionProps = {
  title: string
  children: ReactNode
}

type SettingsRowProps = {
  icon: ReactNode
  title: string
  subtitle?: string
  value?: string
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
}

const accentClassNames: Record<AccentOption, string> = {
  green: 'accent-green',
  blue: 'accent-blue',
  purple: 'accent-purple',
  orange: 'accent-orange',
  teal: 'accent-teal',
}

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M15 18 9 12l6-6" />
    </svg>
  )
}

function UserCircleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M19.5 20.2a7.5 7.5 0 0 0-15 0" />
      <path d="M12 12a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z" />
    </svg>
  )
}

function SettingsGlyph({ children }: { children: ReactNode }) {
  return <span className="settings-row-icon" aria-hidden="true">{children}</span>
}

function CompactSettingsHeader({
  subtitle,
  onBack,
  onBrandClick = onBack,
}: {
  subtitle: string
  onBack: () => void
  onBrandClick?: () => void
}) {
  return (
    <header className="settings-topbar">
      <button
        className="settings-back-button"
        type="button"
        aria-label="Vissza"
        onClick={onBack}
      >
        <ArrowLeftIcon />
      </button>
      <div className="settings-brand-group">
        <BrandHeader
          section="Profil"
          className="settings-brand-header"
          onHome={onBrandClick}
        />
        <span>{subtitle}</span>
      </div>
    </header>
  )
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className="compact-settings-section">
      <h2>{title}</h2>
      <div className="settings-row-group">{children}</div>
    </section>
  )
}

function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  danger,
  disabled,
  onClick,
}: SettingsRowProps) {
  const content = (
    <>
      {icon}
      <span className="settings-row-copy">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      {value ? <span className="settings-row-value">{value}</span> : null}
      {onClick ? <span className="settings-row-chevron" aria-hidden="true">›</span> : null}
    </>
  )

  if (onClick) {
    return (
      <button
        className={danger ? 'settings-row danger' : 'settings-row'}
        type="button"
        onClick={onClick}
        disabled={disabled}
      >
        {content}
      </button>
    )
  }

  return <div className={danger ? 'settings-row danger' : 'settings-row'}>{content}</div>
}

function CurrencyManager({
  userId,
  currencies,
  onCurrenciesChanged,
}: {
  userId: string
  currencies: UserCurrency[]
  onCurrenciesChanged: () => Promise<void>
}) {
  const [newCurrencyCode, setNewCurrencyCode] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const sortedCurrencies = useMemo(
    () =>
      [...currencies].sort((firstCurrency, secondCurrency) =>
        firstCurrency.currency_code.localeCompare(secondCurrency.currency_code),
      ),
    [currencies],
  )

  const handleAddCurrency = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const currencyCode = newCurrencyCode.trim().toUpperCase()

    if (!isValidCurrencyCode(currencyCode)) {
      setMessage({
        type: 'error',
        text: 'A pénznem kódja pontosan 3 nagybetű legyen.',
      })
      return
    }

    if (
      currencies.some(
        (currency) => currency.currency_code === normalizeCurrencyCode(currencyCode),
      )
    ) {
      setMessage({
        type: 'error',
        text: 'Ez a pénznem már létezik.',
      })
      return
    }

    setIsSaving(true)

    const { error } = await supabase.from('user_currencies').insert({
      user_id: userId,
      currency_code: currencyCode,
      is_active: true,
      is_default: currencies.length === 0,
    })

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült hozzáadni a pénznemet: ${error.message}`,
      })
      setIsSaving(false)
      return
    }

    setNewCurrencyCode('')
    await onCurrenciesChanged()
    setMessage({
      type: 'success',
      text: 'A pénznem hozzáadva.',
    })
    setIsSaving(false)
  }

  const handleSetDefault = async (currency: UserCurrency) => {
    if (currency.is_default) {
      return
    }

    setIsSaving(true)
    setMessage(null)

    const { error: clearError } = await supabase
      .from('user_currencies')
      .update({ is_default: false })
      .eq('user_id', userId)

    if (clearError) {
      setMessage({
        type: 'error',
        text: `Nem sikerült módosítani az alapértelmezett pénznemet: ${clearError.message}`,
      })
      setIsSaving(false)
      return
    }

    const { error: defaultError } = await supabase
      .from('user_currencies')
      .update({ is_default: true, is_active: true })
      .eq('id', currency.id)
      .eq('user_id', userId)

    if (defaultError) {
      setMessage({
        type: 'error',
        text: `Nem sikerült módosítani az alapértelmezett pénznemet: ${defaultError.message}`,
      })
      setIsSaving(false)
      return
    }

    await onCurrenciesChanged()
    setMessage({
      type: 'success',
      text: 'Az alapértelmezett pénznem módosítva.',
    })
    setIsSaving(false)
  }

  const handleToggleActive = async (currency: UserCurrency) => {
    if (currency.is_default) {
      setMessage({
        type: 'error',
        text: 'Az alapértelmezett pénznem nem kapcsolható ki.',
      })
      return
    }

    setIsSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('user_currencies')
      .update({ is_active: !currency.is_active })
      .eq('id', currency.id)
      .eq('user_id', userId)

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült módosítani a pénznemet: ${error.message}`,
      })
      setIsSaving(false)
      return
    }

    await onCurrenciesChanged()
    setIsSaving(false)
  }

  const handleDelete = async (currency: UserCurrency) => {
    if (currency.is_default) {
      setMessage({
        type: 'error',
        text: 'Az alapértelmezett pénznem nem törölhető.',
      })
      return
    }

    setMessage(null)

    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('currency', currency.currency_code)

    if (countError) {
      setMessage({
        type: 'error',
        text: `Nem sikerült ellenőrizni a pénznemet: ${countError.message}`,
      })
      return
    }

    if ((count ?? 0) > 0) {
      setMessage({
        type: 'error',
        text: 'A pénznem nem törölhető, mert tranzakciók használják.',
      })
      return
    }

    setIsSaving(true)

    const { error } = await supabase
      .from('user_currencies')
      .delete()
      .eq('id', currency.id)
      .eq('user_id', userId)

    if (error) {
      setMessage({
        type: 'error',
        text: `Nem sikerült törölni a pénznemet: ${error.message}`,
      })
      setIsSaving(false)
      return
    }

    await onCurrenciesChanged()
    setIsSaving(false)
  }

  return (
    <section className="settings-section currency-manager">
      <div>
        <h2>Pénznemek</h2>
        <p className="subtle-text">
          Az alapértelmezett pénznem csak az új tranzakciókat érinti.
        </p>
      </div>

      <form className="currency-form" onSubmit={handleAddCurrency}>
        <label htmlFor="newCurrencyCode">
          ISO kód
          <input
            id="newCurrencyCode"
            type="text"
            value={newCurrencyCode}
            onChange={(event) =>
              setNewCurrencyCode(event.target.value.toUpperCase())
            }
            maxLength={3}
            placeholder="EUR"
            disabled={isSaving}
          />
        </label>
        <button className="primary-button" type="submit" disabled={isSaving}>
          Hozzáadás
        </button>
      </form>

      {message ? (
        <p className={`message ${message.type}`} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="currency-list">
        {sortedCurrencies.map((currency) => (
          <article className="currency-item" key={currency.id}>
            <div>
              <strong>{currency.currency_code}</strong>
              <span>
                {currency.is_default ? 'Alapértelmezett' : 'Nem alapértelmezett'} ·{' '}
                {currency.is_active ? 'Aktív' : 'Inaktív'}
              </span>
            </div>
            <div className="currency-actions">
              {!currency.is_default ? (
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => void handleSetDefault(currency)}
                  disabled={isSaving}
                >
                  Alapértelmezetté tesz
                </button>
              ) : null}
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={() => void handleToggleActive(currency)}
                disabled={isSaving || currency.is_default}
              >
                {currency.is_active ? 'Kikapcsolás' : 'Aktiválás'}
              </button>
              <button
                className="secondary-button compact-button danger-button"
                type="button"
                onClick={() => void handleDelete(currency)}
                disabled={isSaving || currency.is_default}
              >
                Törlés
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ProfileView({
  userId,
  email,
  fullName,
  theme,
  accent,
  themeOptions,
  accentOptions,
  onThemeChange,
  onAccentChange,
  onFullNameSaved,
  onBack,
  onLogout,
  isLoggingOut,
}: ProfileViewProps) {
  const [editableFullName, setEditableFullName] = useState(fullName)
  const [isSaving, setIsSaving] = useState(false)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [isCurrencyManagerOpen, setIsCurrencyManagerOpen] = useState(false)
  const [currencies, setCurrencies] = useState<UserCurrency[]>([])
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [openSetting, setOpenSetting] = useState<'theme' | 'accent' | null>(
    null,
  )
  const [message, setMessage] = useState<Message | null>(null)

  const selectedThemeLabel =
    themeOptions.find((option) => option.value === theme)?.label ?? ''
  const selectedAccentLabel =
    accentOptions.find((option) => option.value === accent)?.label ?? ''
  const selectedDefaultCurrency =
    getDefaultCurrency(currencies)?.currency_code ?? defaultCurrencyCode

  const loadCurrencies = useCallback(async () => {
    const { data } = await ensureInitialUserCurrencies(userId)
    setCurrencies(data)
  }, [userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCurrencies()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCurrencies])

  const toggleSetting = (setting: 'theme' | 'accent') => {
    setOpenSetting((currentSetting) =>
      currentSetting === setting ? null : setting,
    )
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const updatedFullName = editableFullName.trim()

    if (!updatedFullName) {
      setMessage({
        type: 'error',
        text: 'A teljes név nem lehet üres.',
      })
      return
    }

    setIsSaving(true)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: updatedFullName })
      .eq('id', userId)
      .select('full_name')
      .single()

    if (profileError) {
      setMessage({
        type: 'error',
        text: 'Nem sikerült menteni a profilt. Próbáld újra.',
      })
      setIsSaving(false)
      return
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        full_name: updatedFullName,
      },
    })

    if (metadataError) {
      setMessage({
        type: 'error',
        text: 'A név mentése sikerült, de a fiókadatok frissítése nem.',
      })
      setIsSaving(false)
      return
    }

    onFullNameSaved(updatedFullName)
    setEditableFullName(updatedFullName)
    setIsEditingProfile(false)
    setMessage({
      type: 'success',
      text: 'A profiladatok mentése sikerült.',
    })
    setIsSaving(false)
  }

  if (isCategoryManagerOpen) {
    return (
      <main className="app-shell page-shell">
        <section className="settings-panel profile-settings-panel">
          <CompactSettingsHeader
            subtitle="Kategóriák"
            onBack={() => setIsCategoryManagerOpen(false)}
            onBrandClick={onBack}
          />
          <CategoryManager userId={userId} />
        </section>
      </main>
    )
  }

  if (isCurrencyManagerOpen) {
    return (
      <main className="app-shell page-shell">
        <section className="settings-panel profile-settings-panel">
          <CompactSettingsHeader
            subtitle="Pénznemek"
            onBack={() => setIsCurrencyManagerOpen(false)}
            onBrandClick={onBack}
          />
          <CurrencyManager
            userId={userId}
            currencies={currencies}
            onCurrenciesChanged={loadCurrencies}
          />
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell page-shell">
      <section className="settings-panel profile-settings-panel">
        <CompactSettingsHeader subtitle="Beállítások" onBack={onBack} />

        <section className="profile-card">
          <span className="profile-avatar">
            <UserCircleIcon />
          </span>
          <span className="profile-card-copy">
            <strong>{fullName}</strong>
            <small>{email}</small>
          </span>
          <button
            className="profile-edit-button"
            type="button"
            onClick={() => {
              setEditableFullName(fullName)
              setIsEditingProfile(true)
              setMessage(null)
            }}
          >
            Szerkesztés
          </button>
        </section>

        {isEditingProfile ? (
          <form className="profile-edit-form" onSubmit={handleSave}>
            <label htmlFor="profileFullName">
              Teljes név
              <input
                id="profileFullName"
                type="text"
                name="profileFullName"
                autoComplete="name"
                value={editableFullName}
                onChange={(event) => setEditableFullName(event.target.value)}
                required
              />
            </label>
            <div className="profile-edit-actions">
              <button className="primary-button" type="submit" disabled={isSaving}>
                {isSaving ? 'Mentés...' : 'Mentés'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditableFullName(fullName)
                  setIsEditingProfile(false)
                  setMessage(null)
                }}
                disabled={isSaving}
              >
                Mégse
              </button>
            </div>
          </form>
        ) : null}

        {message ? (
          <p className={`message ${message.type}`} role="status">
            {message.text}
          </p>
        ) : null}

        <SettingsSection title="Megjelenés">
          <SettingsRow
            icon={<SettingsGlyph>◐</SettingsGlyph>}
            title="Téma"
            value={selectedThemeLabel}
            onClick={() => toggleSetting('theme')}
          />
          {openSetting === 'theme' ? (
            <div
              className="compact-choice-control"
              role="group"
              aria-label="Megjelenési mód"
            >
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={theme === option.value ? 'active' : ''}
                  aria-pressed={theme === option.value}
                  onClick={() => onThemeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          <SettingsRow
            icon={<SettingsGlyph>●</SettingsGlyph>}
            title="Kiemelőszín"
            value={selectedAccentLabel}
            onClick={() => toggleSetting('accent')}
          />
          {openSetting === 'accent' ? (
            <div
              className="compact-accent-grid"
              role="group"
              aria-label="Kiemelőszín"
            >
              {accentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    accent === option.value
                      ? `active ${accentClassNames[option.value]}`
                      : accentClassNames[option.value]
                  }
                  aria-label={`${option.label} kiemelőszín`}
                  aria-pressed={accent === option.value}
                  onClick={() => onAccentChange(option.value)}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}
        </SettingsSection>

        <SettingsSection title="Adatok és kategóriák">
          <SettingsRow
            icon={<SettingsGlyph>□</SettingsGlyph>}
            title="Kategóriák kezelése"
            subtitle="Nevek, ikonok és színek"
            onClick={() => setIsCategoryManagerOpen(true)}
          />
          <SettingsRow
            icon={<SettingsGlyph>Ft</SettingsGlyph>}
            title="Pénznemek"
            subtitle="Aktív és alapértelmezett pénznemek"
            value={selectedDefaultCurrency}
            onClick={() => setIsCurrencyManagerOpen(true)}
          />
        </SettingsSection>

        <SettingsSection title="Fiók">
          <SettingsRow
            icon={<SettingsGlyph>↩</SettingsGlyph>}
            title={isLoggingOut ? 'Kijelentkezés...' : 'Kijelentkezés'}
            danger
            disabled={isLoggingOut}
            onClick={() => void onLogout()}
          />
        </SettingsSection>
      </section>
    </main>
  )
}
