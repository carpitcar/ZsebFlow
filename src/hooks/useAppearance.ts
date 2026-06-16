import { useEffect, useState } from 'react'
import {
  accentOptions,
  themeOptions,
  type AccentOption,
  type ThemeOption,
} from '../types/appearance'

const themeStorageKey = 'zsebflow-theme'
const accentStorageKey = 'zsebflow-accent'

const isThemeOption = (value: string | null): value is ThemeOption =>
  themeOptions.some((option) => option.value === value)

const isAccentOption = (value: string | null): value is AccentOption =>
  accentOptions.some((option) => option.value === value)

const getStoredTheme = (): ThemeOption => {
  try {
    const storedTheme = localStorage.getItem(themeStorageKey)
    return isThemeOption(storedTheme) ? storedTheme : 'system'
  } catch {
    return 'system'
  }
}

const getStoredAccent = (): AccentOption => {
  try {
    const storedAccent = localStorage.getItem(accentStorageKey)
    return isAccentOption(storedAccent) ? storedAccent : 'green'
  } catch {
    return 'green'
  }
}

export function useAppearance() {
  const [theme, setTheme] = useState<ThemeOption>(getStoredTheme)
  const [accent, setAccent] = useState<AccentOption>(getStoredAccent)

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    try {
      localStorage.setItem(themeStorageKey, theme)
    } catch {
      // A felulet mukodjon akkor is, ha a tarhely nem elerheto.
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.accent = accent

    try {
      localStorage.setItem(accentStorageKey, accent)
    } catch {
      // A felulet mukodjon akkor is, ha a tarhely nem elerheto.
    }
  }, [accent])

  return {
    theme,
    setTheme,
    accent,
    setAccent,
    themeOptions,
    accentOptions,
  }
}
