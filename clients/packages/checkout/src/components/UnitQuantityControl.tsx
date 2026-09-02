'use client'

import { Button, Input } from '@polar-sh/orbit'
import { type ChangeEvent, type KeyboardEvent, useState } from 'react'
import MinusIcon from './icons/MinusIcon'
import PlusIcon from './icons/PlusIcon'

interface UnitQuantityControlProps {
  units: number
  minimumUnits: number
  maximumUnits: number | null
  isUpdating: boolean
  onUpdate: (units: number) => Promise<void>
}

const NUMERIC_INPUT_PATTERN = /^\d+$/

export const UnitQuantityControl = ({
  units,
  minimumUnits,
  maximumUnits,
  isUpdating,
  onUpdate,
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
      Number.isSafeInteger(newUnits) &&
      newUnits >= minimumUnits &&
      (!hasMaximumLimit || newUnits <= maximumUnits) &&
      newUnits !== units
    ) {
      onUpdate(newUnits)
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

  const quantityButtonClassName =
    'dark:text-polar-400 dark:hover:bg-polar-800 flex h-7 w-7 cursor-pointer items-center justify-center leading-none text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="dark:border-polar-700 flex items-center gap-0 rounded-lg border border-gray-200">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => void onUpdate(units - 1)}
        disabled={units <= minimumUnits || isUpdating || isEditing}
        className={`${quantityButtonClassName} rounded-l-lg`}
        aria-label="Decrease units"
      >
        <MinusIcon className="h-3 w-3" />
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
          className="h-7 min-w-10 cursor-text rounded-none border-x border-y-0 px-2 text-center text-sm font-medium tabular-nums"
          style={{ width: `${Math.max(inputValue.length, 2) + 2}ch` }}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={startEditing}
          disabled={isUpdating}
          className="dark:border-polar-700 dark:hover:bg-polar-800 h-7 min-w-10 cursor-pointer rounded-none border-x border-gray-200 px-2 text-center text-sm font-medium tabular-nums transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        className={`${quantityButtonClassName} rounded-r-lg`}
        aria-label="Increase units"
      >
        <PlusIcon className="h-3 w-3" />
      </Button>
    </div>
  )
}
