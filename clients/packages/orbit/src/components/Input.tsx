'use client'

import {
  ChangeEvent,
  FocusEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

// ─── Currency utilities (mirrors @polar-sh/currency) ─────────────────────────

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
])

function isDecimalCurrency(currency: string): boolean {
  return !ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
}

function getCurrencyDecimalFactor(currency: string): number {
  return isDecimalCurrency(currency) ? 100 : 1
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const fieldClass =
  'min-w-0 flex-1 h-9 px-3 py-2 border-0 border-transparent appearance-none ' +
  'bg-neutral-50 dark:bg-polar-900 ' +
  'text-sm text-black dark:text-white tracking-tight ' +
  'placeholder:text-neutral-400 dark:placeholder:text-polar-500 ' +
  'outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0 focus:shadow-none focus:bg-neutral-100 dark:focus:bg-polar-800 ' +
  'transition-colors duration-150 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const slotClass =
  'flex shrink-0 items-center px-3 ' +
  'bg-neutral-100 dark:bg-polar-800 ' +
  'text-sm text-neutral-500 dark:text-polar-500 tracking-tight select-none'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlotProps {
  prefix?: React.ReactNode
  suffix?: React.ReactNode
}

export interface CurrencyInputProps extends SlotProps {
  type: 'currency'
  name?: string
  id?: string
  currency: string
  value?: number | null
  placeholder?: number
  onChange?: (value: number | null) => void
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void
  disabled?: boolean
  className?: string
  /** Step size for ↑/↓ arrow key adjustment. Default: 0.1 */
  step?: number
}

export interface TextareaInputProps
  extends
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'>,
    SlotProps {
  type: 'textarea'
}

export interface StandardInputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'>,
    SlotProps {}

export type InputProps =
  | StandardInputProps
  | CurrencyInputProps
  | TextareaInputProps

// ─── Shell (renders prefix/suffix as adjacent bordered blocks) ────────────────

function InputShell({
  prefix,
  suffix,
  children,
}: SlotProps & { children: React.ReactNode }) {
  return (
    <div className="flex w-full overflow-hidden rounded-lg border border-black/5 dark:border-white/6">
      {prefix !== undefined && <div className={slotClass}>{prefix}</div>}
      {children}
      {suffix !== undefined && <div className={slotClass}>{suffix}</div>}
    </div>
  )
}

// ─── Currency input ───────────────────────────────────────────────────────────

function CurrencyInputField({
  id,
  name,
  currency,
  value,
  placeholder,
  prefix,
  suffix,
  onChange: _onChange,
  onBlur: _onBlur,
  onFocus,
  disabled,
  className,
  step = 0.1,
}: CurrencyInputProps) {
  const decimalFactor = useMemo(
    () => getCurrencyDecimalFactor(currency),
    [currency],
  )
  const isNonDecimal = useMemo(() => !isDecimalCurrency(currency), [currency])

  const toDisplay = useCallback(
    (v: number | null | undefined): string | undefined => {
      if (v == null) return undefined
      return isNonDecimal ? v.toString() : (v / decimalFactor).toFixed(2)
    },
    [decimalFactor, isNonDecimal],
  )

  const toUnits = useCallback(
    (v: string): number => {
      const n = Number.parseFloat(v)
      if (isNaN(n)) return 0
      return isNonDecimal ? Math.round(n) : Math.round(n * decimalFactor)
    },
    [decimalFactor, isNonDecimal],
  )

  const [prev, setPrev] = useState<number | null | undefined>(value)
  const [display, setDisplay] = useState<string | undefined>(toDisplay(value))

  useEffect(() => {
    if (value !== prev) {
      setPrev(value)
      setDisplay(toDisplay(value))
    }
  }, [value, prev, toDisplay])

  const commit = useCallback(
    (raw: string) => {
      setDisplay(raw)
      if (!_onChange) return
      if (!raw?.trim()) {
        setPrev(null)
        _onChange(null)
      } else {
        const units = toUnits(raw)
        setPrev(units)
        _onChange(units)
      }
    },
    [_onChange, toUnits],
  )

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value
      if (input === '') {
        commit('')
        return
      }

      if (isNonDecimal) {
        commit(input.replace(/[^0-9]/g, ''))
        return
      }

      const cleaned = input.replace(/[^0-9,.]/g, '')
      let next = cleaned.replace(/[,.](?!$)/g, '').replace(/,$/, '.')

      const match = cleaned.match(/([.,])([0-9]+)$/)
      if (match) {
        const intPart = cleaned.slice(0, -match[0].length).replace(/[,.]/g, '')
        const decPart = match[2].slice(0, 2)
        const parsed = Number.parseFloat(`${intPart}.${decPart}`)
        if (!isNaN(parsed)) {
          const formatted = parsed.toFixed(Math.min(2, match[2].length))
          next =
            intPart.length > 0 ? formatted : formatted.replace(/^0(?=\.)/, '')
        }
      }

      commit(next)
    },
    [commit, isNonDecimal],
  )

  const onBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (display && !isNonDecimal) {
        let next = display
        if (next.startsWith('.')) next = `0${next}`
        if (next.endsWith('.')) next = next.slice(0, -1)
        if (next !== display) commit(next)
      }
      _onBlur?.(e)
    },
    [_onBlur, display, commit, isNonDecimal],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const ctrl = e.ctrlKey || e.metaKey
      const nav = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab']

      if (isNonDecimal) {
        if (!/[0-9]/.test(e.key) && !nav.includes(e.key) && !ctrl)
          e.preventDefault()
        return
      }

      if (!/[0-9.,]/.test(e.key) && !nav.includes(e.key) && !ctrl)
        e.preventDefault()

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const v = Number.parseFloat(e.currentTarget.value)
        commit((!isNaN(v) ? v + step : step).toFixed(2))
      }

      if (e.key === 'ArrowDown') {
        const v = Number.parseFloat(e.currentTarget.value)
        commit(Math.max(0, !isNaN(v) ? v - step : 0).toFixed(2))
      }

      if (
        (e.key === '.' || e.key === ',') &&
        e.currentTarget.value.includes('.')
      )
        e.preventDefault()
    },
    [step, commit, isNonDecimal],
  )

  const displayPlaceholder = useMemo(() => {
    if (placeholder == null) return undefined
    return isNonDecimal
      ? placeholder.toString()
      : (placeholder / decimalFactor).toLocaleString('en-US', {
          minimumFractionDigits: 2,
        })
  }, [placeholder, decimalFactor, isNonDecimal])

  return (
    <InputShell prefix={prefix ?? currency.toUpperCase()} suffix={suffix}>
      <input
        type="text"
        inputMode={isNonDecimal ? 'numeric' : 'decimal'}
        id={id}
        name={name}
        value={display ?? ''}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={displayPlaceholder}
        disabled={disabled}
        className={twMerge(fieldClass, className)}
      />
    </InputShell>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Input(props: InputProps) {
  if (props.type === 'currency') {
    return <CurrencyInputField {...(props as CurrencyInputProps)} />
  }

  if (props.type === 'textarea') {
    const {
      prefix,
      suffix,
      className,
      type: _type,
      ...rest
    } = props as TextareaInputProps
    return (
      <InputShell prefix={prefix} suffix={suffix}>
        <textarea
          className={twMerge(
            fieldClass.replace('h-10', 'min-h-24'),
            'h-auto resize-y',
            className,
          )}
          {...rest}
        />
      </InputShell>
    )
  }

  const { prefix, suffix, className, ...rest } = props as StandardInputProps
  return (
    <InputShell prefix={prefix} suffix={suffix}>
      <input className={twMerge(fieldClass, className)} {...rest} />
    </InputShell>
  )
}
