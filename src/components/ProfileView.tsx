import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { AccentOption, ThemeOption } from '../types/appearance'
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

function SettingsGlyph({ children }: { children: React.ReactNode }) {
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
      <button
        className="settings-brand-button"
        type="button"
        onClick={onBrandClick}
      >
        <strong>ZsebFlow</strong>
        <span>{subtitle}</span>
      </button>
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
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [openSetting, setOpenSetting] = useState<'theme' | 'accent' | null>(
    null,
  )
  const [message, setMessage] = useState<Message | null>(null)

  const selectedThemeLabel =
    themeOptions.find((option) => option.value === theme)?.label ?? ''
  const selectedAccentLabel =
    accentOptions.find((option) => option.value === accent)?.label ?? ''

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
            title="Pénznem"
            value="HUF"
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
