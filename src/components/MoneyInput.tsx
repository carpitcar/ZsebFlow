import { formatMoneyInput, sanitizeMoneyInput } from '../lib/money'

type MoneyInputProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export function MoneyInput({
  id,
  label,
  value,
  onChange,
  required = false,
}: MoneyInputProps) {
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatMoneyInput(value)}
        onChange={(event) => onChange(sanitizeMoneyInput(event.target.value))}
        required={required}
      />
    </label>
  )
}
