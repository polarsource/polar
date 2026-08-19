'use client'

import { Button, Input } from '@polar-sh/orbit'
import { type ChangeEvent, type KeyboardEvent, useState } from 'react'

interface UnitQuantityControlProps {
  units: number
  minimumUnits: number
  maximumUnits: number | null
  isUpdating: boolean
  onUpdate: (units: number) => Promise<void>
  compact?: boolean
}

const NUMERIC_INPUT_PATTERN = /^\d+$/

const QuantityIcon = ({
  increment,
  compact,
}: {
  increment: boolean
  compact: boolean
}) => {
  const path = compact
    ? increment
      ? 'M7 3v8M3 7h8'
      : 'M3 7h8'
    : increment
      ? 'M12 5v14m-7-7h14'
      : 'M5 12h14'

  return (
    <svg
      className={compact ? 'h-3 w-3' : 'h-5 w-5'}
      viewBox={compact ? '0 0 14 14' : '0 0 24 24'}
      fill="none"
      stroke="currentColor"
      strokeWidth={compact ? 2 : 2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  )
}

export const UnitQuantityControl = ({
  units,
  minimumUnits,
  maximumUnits,
  isUpdating,
  onUpdate,
  compact = false,
}: UnitQuantityControlProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const hasMaximumLimit = maximumUnits !== null

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    if (value === '' || NUMERIC_INPUT_PATTERN.test(value)) {
      setInputValue(value)
    }
  }

  const stopEditing = () => {
    setIsEditing(false)
    setInputValue('')
  }

  const handleInputBlur = () => {
    const newUnits = Number.parseInt(inputValue, 10)
    if (
      !Number.isNaN(newUnits) &&
      newUnits >= minimumUnits &&
      (!hasMaximumLimit || newUnits <= maximumUnits) &&
      newUnits !== units
    ) {
      void onUpdate(newUnits)
    }
    stopEditing()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      stopEditing()
    }
  }

  const startEditing = () => {
    setIsEditing(true)
    setInputValue(units.toString())
  }

  const quantityButtonClassName = compact
    ? 'dark:text-polar-400 dark:hover:bg-polar-800 flex h-7 w-7 cursor-pointer items-center justify-center leading-none text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40'
    : 'h-10 w-10 rounded-full disabled:opacity-40'

  return (
    <div
      className={
        compact
          ? 'dark:border-polar-700 flex items-center gap-0 rounded-lg border border-gray-200'
          : 'flex items-center gap-3'
      }
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => void onUpdate(units - 1)}
        disabled={units <= minimumUnits || isUpdating || isEditing}
        className={`${quantityButtonClassName} ${compact ? 'rounded-l-lg' : ''}`}
        aria-label="Decrease units"
      >
        <QuantityIcon increment={false} compact={compact} />
      </Button>
      {isEditing ? (
        <Input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          autoFocus
          min={minimumUnits}
          max={hasMaximumLimit ? maximumUnits : undefined}
          className={
            compact
              ? 'h-7 min-w-10 cursor-text rounded-none border-x border-y-0 px-2 text-center text-sm font-medium tabular-nums'
              : 'h-auto min-w-[3.5rem] py-1.5 text-center text-2xl font-[350] tabular-nums'
          }
          style={{ width: `${Math.max(inputValue.length, 2) + 2}ch` }}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={startEditing}
          disabled={isUpdating}
          className={
            compact
              ? 'dark:border-polar-700 dark:hover:bg-polar-800 h-7 min-w-10 cursor-pointer rounded-none border-x border-gray-200 px-2 text-center text-sm font-medium tabular-nums transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
              : 'dark:hover:bg-polar-800 min-w-[3.5rem] rounded-xl px-3 py-1.5 text-center text-2xl font-[350] text-gray-900 tabular-nums transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white'
          }
          aria-label="Click to edit unit count"
          title="Click to edit"
        >
          {units}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => void onUpdate(units + 1)}
        disabled={
          (hasMaximumLimit && units >= maximumUnits) || isUpdating || isEditing
        }
        className={`${quantityButtonClassName} ${compact ? 'rounded-r-lg' : ''}`}
        aria-label="Increase units"
      >
        <QuantityIcon increment compact={compact} />
      </Button>
    </div>
  )
}
