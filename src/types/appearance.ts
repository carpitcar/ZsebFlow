export const themeOptions = [
  { value: 'light', label: 'Világos' },
  { value: 'dark', label: 'Sötét' },
  { value: 'system', label: 'Rendszer' },
] as const

export const accentOptions = [
  { value: 'green', label: 'Zöld' },
  { value: 'blue', label: 'Kék' },
  { value: 'purple', label: 'Lila' },
  { value: 'orange', label: 'Narancs' },
  { value: 'teal', label: 'Türkiz' },
] as const

export type ThemeOption = (typeof themeOptions)[number]['value']
export type AccentOption = (typeof accentOptions)[number]['value']
