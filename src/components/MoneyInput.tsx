import { isEditableMoneyInput } from '../lib/money'

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
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value

          if (isEditableMoneyInput(nextValue)) {
            onChange(nextValue)
          }
        }}
        required={required}
      />
    </label>
  )
}
