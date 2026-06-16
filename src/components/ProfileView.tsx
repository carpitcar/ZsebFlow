import { useState } from 'react'
import type { FormEvent } from 'react'
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
  const [message, setMessage] = useState<Message | null>(null)

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
    setMessage({
      type: 'success',
      text: 'A profiladatok mentése sikerült.',
    })
    setIsSaving(false)
  }

  return (
    <main className="app-shell page-shell">
      <section className="settings-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Profil</p>
            <h1>Beállítások</h1>
          </div>
          <button className="secondary-button compact-button" type="button" onClick={onBack}>
            Vissza
          </button>
        </div>

        <div className="profile-summary">
          <div>
            <span>Teljes név</span>
            <strong>{fullName}</strong>
          </div>
          <div>
            <span>E-mail cím</span>
            <strong>{email}</strong>
          </div>
        </div>

        <form className="settings-section" onSubmit={handleSave}>
          <h2>Profiladatok</h2>
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
          {message ? (
            <p className={`message ${message.type}`} role="status">
              {message.text}
            </p>
          ) : null}
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Mentés...' : 'Mentés'}
          </button>
        </form>

        <section className="settings-section">
          <h2>Megjelenés</h2>
          <div className="choice-grid" role="group" aria-label="Megjelenési mód">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={theme === option.value ? 'choice active' : 'choice'}
                aria-pressed={theme === option.value}
                onClick={() => onThemeChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h2>Kiemelőszín</h2>
          <div className="swatch-grid" role="group" aria-label="Kiemelőszín">
            {accentOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  accent === option.value
                    ? `swatch active accent-${option.value}`
                    : `swatch accent-${option.value}`
                }
                aria-pressed={accent === option.value}
                onClick={() => onAccentChange(option.value)}
              >
                <span aria-hidden="true" />
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <CategoryManager userId={userId} />

        <button
          className="secondary-button danger-button"
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Kijelentkezés...' : 'Kijelentkezés'}
        </button>
      </section>
    </main>
  )
}
