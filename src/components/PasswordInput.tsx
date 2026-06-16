import { useState } from 'react'

type PasswordInputProps = {
  id: string
  label: string
  name: string
  value: string
  autoComplete: string
  minLength?: number
  onChange: (value: string) => void
}

export function PasswordInput({
  id,
  label,
  name,
  value,
  autoComplete,
  minLength,
  onChange,
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <label htmlFor={id}>
      {label}
      <span className="password-control">
        <input
          id={id}
          type={isVisible ? 'text' : 'password'}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={minLength}
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={
            isVisible ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'
          }
          onClick={() => setIsVisible((currentValue) => !currentValue)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            {isVisible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
                <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c5.5 0 9 5.5 9 5.5a16.1 16.1 0 0 1-3 3.7" />
                <path d="M6.6 6.6A16.1 16.1 0 0 0 3 9.5S6.5 15 12 15a10.8 10.8 0 0 0 3.4-.6" />
              </>
            ) : (
              <>
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </span>
    </label>
  )
}
