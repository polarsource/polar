'use client'

import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import { HTTPValidationError } from '@polar-sh/sdk/models/errors/httpvalidationerror'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useEffect, useState } from 'react'
import type { ProductCheckoutPublic } from '../guards'
import MeteredPricesDisplay from './MeteredPricesDisplay'

export interface CheckoutSeatSelectorProps {
  checkout: ProductCheckoutPublic
  update: (body: CheckoutUpdatePublic) => Promise<ProductCheckoutPublic>
}

const CheckoutSeatSelector = ({
  checkout,
  update,
}: CheckoutSeatSelectorProps) => {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [autoCorrectAttempted, setAutoCorrectAttempted] = useState(false)

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof HTTPValidationError && err.detail?.[0]?.msg) {
      return err.detail[0].msg
    }
    return 'Failed to update seats'
  }

  // Check if the product has seat-based pricing
  const productPrice = checkout.productPrice
  const isSeatBased = productPrice.amountType === 'seat_based'

  if (!isSeatBased) {
    return null
  }

  // Get seat limits from the tiers
  // The minimum comes from the first tier's min_seats, maximum from the last tier's max_seats
  const seatTiers = productPrice.seatTiers
  const tiers = seatTiers?.tiers ?? []
  const sortedTiers = [...tiers].sort((a, b) => a.minSeats - b.minSeats)
  const minimumSeats = sortedTiers[0]?.minSeats ?? 1
  const maximumSeats = sortedTiers[sortedTiers.length - 1]?.maxSeats ?? null
  const hasMaximumLimit = maximumSeats !== null

  // Display seats clamped to at least the minimum
  const displaySeats = Math.max(checkout.seats || minimumSeats, minimumSeats)
  // Track whether the checkout needs to be corrected
  const needsSeatCorrection =
    checkout.seats !== null &&
    checkout.seats !== undefined &&
    checkout.seats < minimumSeats

  const netAmount = checkout.netAmount || 0
  const currency = productPrice.priceCurrency
  const pricePerSeat = checkout.pricePerSeat || 0

  // Auto-correct seat count if it's below the minimum (only attempt once)
  useEffect(() => {
    if (needsSeatCorrection && !isUpdating && !autoCorrectAttempted) {
      setAutoCorrectAttempted(true)
      update({ seats: minimumSeats } as CheckoutUpdatePublic).catch((err) => {
        setError(getErrorMessage(err))
      })
    }
  }, [
    needsSeatCorrection,
    minimumSeats,
    isUpdating,
    update,
    autoCorrectAttempted,
  ])

  const handleUpdateSeats = async (newSeats: number) => {
    if (newSeats < minimumSeats || isUpdating) return
    if (hasMaximumLimit && newSeats > maximumSeats) return

    setIsUpdating(true)
    setError(null)
    try {
      await update({ seats: newSeats } as CheckoutUpdatePublic)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsUpdating(false)
    }
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
      return `${minimumSeats} - ${maximumSeats} seats`
    } else if (minimumSeats > 1) {
      return `Minimum ${minimumSeats} seats`
    } else if (hasMaximumLimit) {
      return `Maximum ${maximumSeats} seats`
    }
    return null
  }

  const seatLimitText = getSeatLimitText()

  return (
    <div className="flex flex-col gap-6">
      {/* Total Amount Display */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-light text-gray-900 dark:text-white">
          {formatCurrencyAndAmount(netAmount, currency, 0)}
        </h1>
        <p className="dark:text-polar-400 text-sm text-gray-500">
          {formatCurrencyAndAmount(pricePerSeat, currency, 0)} per seat
        </p>
      </div>

      {/* Seat Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-lg">Number of seats</label>
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
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
        {seatLimitText && (
          <p className="dark:text-polar-400 text-xs text-gray-500">
            {seatLimitText}
          </p>
        )}
        {error && (
          <p className="text-destructive-foreground text-sm">{error}</p>
        )}
      </div>

      <MeteredPricesDisplay checkout={checkout} />
    </div>
  )
}

export default CheckoutSeatSelector
