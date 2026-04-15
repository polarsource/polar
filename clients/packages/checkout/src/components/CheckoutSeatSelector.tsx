'use client'

import { type schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProductCheckoutPublic } from '../guards'
import { ErrorResponse } from '../providers/CheckoutProvider'
import MeteredPricesDisplay from './MeteredPricesDisplay'

export interface CheckoutSeatSelectorProps {
  checkout: ProductCheckoutPublic
  update: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<schemas['CheckoutPublic']>
  locale?: AcceptedLocale
  compact?: boolean
}

const CheckoutSeatSelector = ({
  checkout,
  update,
  locale = DEFAULT_LOCALE,
  compact = false,
}: CheckoutSeatSelectorProps) => {
  const t = useTranslations(locale)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const autoCorrectAttempted = useRef(false)

  const getErrorMessage = useCallback(
    (error: ErrorResponse<'checkouts:client_update'> | null): string => {
      if (error && error.error === 'PolarRequestValidationError') {
        return error.detail[0]?.msg
      }

      return t('checkout.pricing.seats.updateFailed')
    },
    [t],
  )

  // Check if the product has seat-based pricing
  const productPrice = checkout.product_price
  const isSeatBased = productPrice.amount_type === 'seat_based'

  // Get seat limits from the tiers
  // The minimum comes from the first tier's min_seats, maximum from the last tier's max_seats
  const seatTiers = isSeatBased ? productPrice.seat_tiers : null
  const tiers = seatTiers?.tiers ?? []
  const sortedTiers = [...tiers].sort((a, b) => a.min_seats - b.min_seats)
  const tierMinimumSeats = sortedTiers[0]?.min_seats ?? 1
  const tierMaximumSeats =
    sortedTiers[sortedTiers.length - 1]?.max_seats ?? null
  const minimumSeats = checkout.min_seats ?? tierMinimumSeats
  const maximumSeats = checkout.max_seats ?? tierMaximumSeats
  const hasMaximumLimit = maximumSeats !== null
  const isFixedSeats = hasMaximumLimit && minimumSeats === maximumSeats

  // Display seats clamped to at least the minimum
  const displaySeats = Math.max(checkout.seats || minimumSeats, minimumSeats)
  // Track whether the checkout needs to be corrected
  const needsSeatCorrection =
    checkout.seats !== null &&
    checkout.seats !== undefined &&
    checkout.seats < minimumSeats

  const netAmount = checkout.net_amount || 0
  const currency = checkout.currency ?? 'usd'
  // Auto-correct seat count if it's below the minimum (only attempt once)
  useEffect(() => {
    if (
      isSeatBased &&
      needsSeatCorrection &&
      !isFixedSeats &&
      !isUpdating &&
      !autoCorrectAttempted.current
    ) {
      autoCorrectAttempted.current = true

      update({
        seats: minimumSeats,
      }).catch((err) => {
        setError(getErrorMessage(err))
      })
    }
  }, [
    isSeatBased,
    needsSeatCorrection,
    isFixedSeats,
    minimumSeats,
    isUpdating,
    update,
    getErrorMessage,
  ])

  if (!isSeatBased) {
    return null
  }

  const handleUpdateSeats = async (newSeats: number) => {
    if (newSeats < minimumSeats || isUpdating) return
    if (hasMaximumLimit && newSeats > maximumSeats) return

    setIsUpdating(true)
    setError(null)

    await update({
      seats: newSeats,
    })
      .catch((error) => {
        setError(getErrorMessage(error))
      })
      .finally(() => {
        setIsUpdating(false)
      })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setInputValue(value)
    }
  }

  const handleInputBlur = () => {
    const newSeats = parseInt(inputValue, 10)
    if (
      !isNaN(newSeats) &&
      newSeats >= minimumSeats &&
      (!hasMaximumLimit || newSeats <= maximumSeats) &&
      newSeats !== displaySeats
    ) {
      handleUpdateSeats(newSeats)
    }
    setIsEditing(false)
    setInputValue('')
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setInputValue('')
    }
  }

  const handleSeatClick = () => {
    setIsEditing(true)
    setInputValue(displaySeats.toString())
  }

  // Build seat limit description
  const getSeatLimitText = () => {
    if (minimumSeats > 1 && hasMaximumLimit) {
      return t('checkout.pricing.seats.range', {
        min: minimumSeats,
        max: maximumSeats,
      })
    } else if (minimumSeats > 1) {
      return t('checkout.pricing.seats.minimum', { min: minimumSeats })
    } else if (hasMaximumLimit) {
      return t('checkout.pricing.seats.maximum', { max: maximumSeats })
    }
    return null
  }

  const seatLimitText = getSeatLimitText()

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium dark:text-white">
              {t('checkout.pricing.seats.label')}
            </span>
          </div>
          {isFixedSeats ? (
            <span className="text-sm font-medium dark:text-white">
              {displaySeats}
            </span>
          ) : (
            <div className="dark:border-polar-700 flex items-center gap-0 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => handleUpdateSeats(displaySeats - 1)}
                disabled={
                  displaySeats <= minimumSeats || isUpdating || isEditing
                }
                className="dark:text-polar-400 dark:hover:bg-polar-800 flex h-7 w-7 cursor-pointer items-center justify-center rounded-l-lg leading-none text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Decrease seats"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M3 7h8" />
                </svg>
              </button>
              {isEditing ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  onKeyDown={handleInputKeyDown}
                  autoFocus
                  min={minimumSeats}
                  max={hasMaximumLimit ? maximumSeats : undefined}
                  className="h-7 w-10 cursor-text rounded-none border-x border-y-0 px-1 text-center text-sm font-medium tabular-nums"
                />
              ) : (
                <button
                  type="button"
                  onClick={handleSeatClick}
                  disabled={isUpdating}
                  className="dark:border-polar-700 dark:hover:bg-polar-800 h-7 w-10 cursor-pointer border-x border-gray-200 text-center text-sm font-medium tabular-nums transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Click to edit seat count"
                  title="Click to edit"
                >
                  {displaySeats}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleUpdateSeats(displaySeats + 1)}
                disabled={
                  (hasMaximumLimit && displaySeats >= maximumSeats) ||
                  isUpdating ||
                  isEditing
                }
                className="dark:text-polar-400 dark:hover:bg-polar-800 flex h-7 w-7 cursor-pointer items-center justify-center rounded-r-lg leading-none text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Increase seats"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M7 3v8M3 7h8" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {!isFixedSeats && seatLimitText && (
          <p className="dark:text-polar-400 text-xs text-gray-500">
            {seatLimitText}
          </p>
        )}
        {error && (
          <p className="text-destructive-foreground text-sm">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Total Amount Display */}
      <div className="flex flex-col gap-2">
        <h1
          className="text-3xl font-light text-gray-900 dark:text-white"
          data-testid="headline-price"
        >
          {formatCurrency('compact', locale)(netAmount, currency)}
        </h1>
      </div>

      {/* Seat Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-lg">
          {t('checkout.pricing.seats.numberOfSeats')}
        </label>
        {isFixedSeats ? (
          <span className="min-w-[3.5rem] text-2xl font-light text-gray-900 dark:text-white">
            {displaySeats}
          </span>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleUpdateSeats(displaySeats - 1)}
              disabled={displaySeats <= minimumSeats || isUpdating || isEditing}
              className="h-10 w-10 rounded-full disabled:opacity-40"
              aria-label="Decrease seats"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12h14"
                />
              </svg>
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
                min={minimumSeats}
                max={hasMaximumLimit ? maximumSeats : undefined}
                className="h-auto max-w-[4.5rem] min-w-[3.5rem] py-1.5 text-center text-2xl font-light tabular-nums"
              />
            ) : (
              <button
                type="button"
                onClick={handleSeatClick}
                disabled={isUpdating}
                className="dark:hover:bg-polar-800 group relative min-w-[3.5rem] rounded-xl px-3 py-1.5 text-center text-2xl font-light text-gray-900 tabular-nums transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
                aria-label="Click to edit seat count"
                title="Click to edit"
              >
                <span>{displaySeats}</span>
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleUpdateSeats(displaySeats + 1)}
              disabled={
                (hasMaximumLimit && displaySeats >= maximumSeats) ||
                isUpdating ||
                isEditing
              }
              className="h-10 w-10 rounded-full disabled:opacity-40"
              aria-label="Increase seats"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 5v14m-7-7h14"
                />
              </svg>
            </Button>
          </div>
        )}
        {!isFixedSeats && seatLimitText && (
          <p className="dark:text-polar-400 text-xs text-gray-500">
            {seatLimitText}
          </p>
        )}
        {error && (
          <p className="text-destructive-foreground text-sm">{error}</p>
        )}
      </div>

      <MeteredPricesDisplay checkout={checkout} locale={locale} />
    </div>
  )
}

export default CheckoutSeatSelector
