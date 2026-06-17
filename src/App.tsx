import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { DashboardView } from './components/DashboardView'
import { MobileBottomNav } from './components/MobileBottomNav'
import { PasswordInput } from './components/PasswordInput'
import { ProfileView } from './components/ProfileView'
import { useAppearance } from './hooks/useAppearance'
import { supabase } from './lib/supabase'
import './App.css'

type AuthMode = 'login' | 'register'
type AppView = 'dashboard' | 'profile'
type Message = {
  type: 'success' | 'error'
  text: string
}
type UserProfile = {
  full_name: string | null
}

const getMetadataFullName = (session: Session | null) => {
  const fullName = session?.user.user_metadata.full_name
  return typeof fullName === 'string' ? fullName.trim() : ''
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<AuthMode>('login')
  const [view, setView] = useState<AppView>('dashboard')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [newTransactionRequest, setNewTransactionRequest] = useState(0)
  const [message, setMessage] = useState<Message | null>(null)
  const appearance = useAppearance()

  const displayEmail = session?.user.email ?? ''
  const displayName =
    profile?.full_name?.trim() ||
    getMetadataFullName(session) ||
    displayEmail ||
    'Felhasználó'

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (error) {
        setMessage({
          type: 'error',
          text: 'Nem sikerült betölteni a bejelentkezési állapotot.',
        })
      }

      setSession(data.session)
      setIsInitializing(false)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)

      if (!currentSession) {
        setProfile(null)
        setView('dashboard')
      }
    })

    loadSession()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    let isMounted = true

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      setProfile(error ? null : data)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [session])

  const resetForm = () => {
    setFullName('')
    setEmail('')
    setPassword('')
    setPasswordConfirmation('')
  }

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setConfirmationEmail('')
    setMessage(null)
    setPassword('')
    setPasswordConfirmation('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setIsSubmitting(true)

    const normalizedEmail = email.trim()
    const normalizedFullName = fullName.trim()

    if (mode === 'register' && normalizedFullName.length === 0) {
      setMessage({
        type: 'error',
        text: 'Add meg a teljes neved a regisztrációhoz.',
      })
      setIsSubmitting(false)
      return
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        setMessage({
          type: 'error',
          text: 'Sikertelen bejelentkezés. Ellenőrizd az e-mail címet és a jelszót.',
        })
      } else {
        setMessage({
          type: 'success',
          text: 'Sikeres bejelentkezés.',
        })
        setConfirmationEmail('')
        resetForm()
      }

      setIsSubmitting(false)
      return
    }

    if (!password || !passwordConfirmation) {
      setMessage({
        type: 'error',
        text: 'Add meg mindkét jelszó mezőt.',
      })
      setIsSubmitting(false)
      return
    }

    if (password.length < 8) {
      setMessage({
        type: 'error',
        text: 'A jelszónak legalább 8 karakter hosszúnak kell lennie.',
      })
      setIsSubmitting(false)
      return
    }

    if (password !== passwordConfirmation) {
      setMessage({
        type: 'error',
        text: 'A két jelszó nem egyezik.',
      })
      setIsSubmitting(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: normalizedFullName,
        },
      },
    })

    if (error) {
      setMessage({
        type: 'error',
        text: error.message.includes('already registered')
          ? 'Ez az e-mail cím már regisztrálva van.'
          : 'Sikertelen regisztráció. Ellenőrizd az adatokat, majd próbáld újra.',
      })
    } else if (data.session) {
      setMessage({
        type: 'success',
        text: 'Sikeres regisztráció és bejelentkezés.',
      })
      setConfirmationEmail('')
      resetForm()
    } else {
      setConfirmationEmail(normalizedEmail)
      setMessage(null)
      resetForm()
    }

    setIsSubmitting(false)
  }

  const handleLogout = async () => {
    setMessage(null)
    setIsSubmitting(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setMessage({
        type: 'error',
        text: 'Nem sikerült kijelentkezni. Próbáld újra.',
      })
    } else {
      setMessage({
        type: 'success',
        text: 'Sikeresen kijelentkeztél.',
      })
      setProfile(null)
      setView('dashboard')
    }

    setIsSubmitting(false)
  }

  const handleFullNameSaved = (updatedFullName: string) => {
    setProfile({ full_name: updatedFullName })
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession
      }

      return {
        ...currentSession,
        user: {
          ...currentSession.user,
          user_metadata: {
            ...currentSession.user.user_metadata,
            full_name: updatedFullName,
          },
        },
      }
    })
  }

  const requestNewTransaction = () => {
    setNewTransactionRequest((request) => request + 1)
    setView('dashboard')
  }

  if (isInitializing) {
    return (
      <main className="app-shell">
        <section className="auth-panel" aria-live="polite">
          <p className="eyebrow">ZsebFlow</p>
          <h1>Betöltés...</h1>
          <p>Bejelentkezési állapot ellenőrzése.</p>
        </section>
      </main>
    )
  }

  if (session && view === 'profile') {
    return (
      <>
        <ProfileView
          key={`${session.user.id}-${displayName}`}
          userId={session.user.id}
          email={displayEmail}
          fullName={displayName}
          theme={appearance.theme}
          accent={appearance.accent}
          themeOptions={appearance.themeOptions}
          accentOptions={appearance.accentOptions}
          onThemeChange={appearance.setTheme}
          onAccentChange={appearance.setAccent}
          onFullNameSaved={handleFullNameSaved}
          onBack={() => setView('dashboard')}
          onLogout={handleLogout}
          isLoggingOut={isSubmitting}
        />
        <MobileBottomNav
          activeItem="profile"
          onHome={() => setView('dashboard')}
          onTransactions={() => setView('dashboard')}
          onAdd={requestNewTransaction}
          onReports={() => setView('dashboard')}
          onProfile={() => setView('profile')}
        />
      </>
    )
  }

  if (session) {
    return (
      <DashboardView
        userId={session.user.id}
        newTransactionRequest={newTransactionRequest}
        onOpenProfile={() => setView('profile')}
        onLogout={handleLogout}
        isLoggingOut={isSubmitting}
      />
    )
  }

  const isLogin = mode === 'login'

  return (
    <main className="app-shell">
      <section className="auth-panel">
        <div className="auth-heading">
          <p className="eyebrow">ZsebFlow</p>
          <h1>{isLogin ? 'Bejelentkezés' : 'Regisztráció'}</h1>
          <p>
            {isLogin
              ? 'Lépj be a háztartási pénztáradhoz.'
              : 'Hozd létre a ZsebFlow fiókodat.'}
          </p>
        </div>

        <div className="mode-switch" aria-label="Űrlap típusa">
          <button
            type="button"
            className={isLogin ? 'active' : ''}
            onClick={() => changeMode('login')}
          >
            Belépés
          </button>
          <button
            type="button"
            className={!isLogin ? 'active' : ''}
            onClick={() => changeMode('register')}
          >
            Regisztráció
          </button>
        </div>

        {!isLogin && confirmationEmail ? (
          <div className="confirmation-panel" role="status">
            <p>
              Sikeres regisztráció! Elküldtük a megerősítő e-mailt a megadott
              címre. A regisztráció befejezéséhez nyisd meg az üzenetet, majd
              kattints a benne található megerősítő linkre. Ezután
              visszatérhetsz a ZsebFlow alkalmazásba és bejelentkezhetsz.
            </p>
            <strong>{confirmationEmail}</strong>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setMode('login')
                setEmail(confirmationEmail)
                setConfirmationEmail('')
                setMessage(null)
              }}
            >
              Vissza a bejelentkezéshez
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin ? (
              <label htmlFor="fullName">
                Teljes név
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </label>
            ) : null}

            <label htmlFor="email">
              E-mail cím
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <PasswordInput
              id="password"
              label="Jelszó"
              name="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              minLength={isLogin ? undefined : 8}
              onChange={setPassword}
            />

            {!isLogin ? (
              <PasswordInput
                id="passwordConfirmation"
                label="Jelszó újra"
                name="passwordConfirmation"
                autoComplete="new-password"
                value={passwordConfirmation}
                minLength={8}
                onChange={setPasswordConfirmation}
              />
            ) : null}

            {message ? (
              <p className={`message ${message.type}`} role="status">
                {message.text}
              </p>
            ) : null}

            <button
              className="primary-button"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Feldolgozás...'
                : isLogin
                  ? 'Bejelentkezés'
                  : 'Regisztráció'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

export default App
