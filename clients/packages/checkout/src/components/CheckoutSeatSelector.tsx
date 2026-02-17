'use client'

import { formatCurrency } from '@polar-sh/currency'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import { HTTPValidationError } from '@polar-sh/sdk/models/errors/httpvalidationerror'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useEffect, useMemo, useState } from 'react'
import type { ProductCheckoutPublic } from '../guards'
import MeteredPricesDisplay from './MeteredPricesDisplay'

export interface CheckoutSeatSelectorProps {
  checkout: ProductCheckoutPublic
  update: (body: CheckoutUpdatePublic) => Promise<ProductCheckoutPublic>
  locale?: AcceptedLocale
}

const CheckoutSeatSelector = ({
  checkout,
  update,
  locale = DEFAULT_LOCALE,
}: CheckoutSeatSelectorProps) => {
  const t = useTranslations(locale)
  const [isUpdating, setIsUpdating] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [autoCorrectAttempted, setAutoCorrectAttempted] = useState(false)

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof HTTPValidationError && err.detail?.[0]?.msg) {
      return err.detail[0].msg
    }
    return t('checkout.seats.updateFailed')
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

  useEffect(() => {
    setInputValue(displaySeats.toString())
  }, [displaySeats])

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

    console.log(newSeats)

    if (
      !isNaN(newSeats) &&
      newSeats >= minimumSeats &&
      (!hasMaximumLimit || newSeats <= maximumSeats) &&
      newSeats !== displaySeats
    ) {
      handleUpdateSeats(newSeats)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.currentTarget.blur()
    }
  }

  // Build seat limit description
  const seatLimitText = useMemo(() => {
    if (minimumSeats > 1 && hasMaximumLimit) {
      return t('checkout.seats.seatRange', {
        min: String(minimumSeats),
        max: String(maximumSeats),
      })
    } else if (minimumSeats > 1) {
      return t('checkout.seats.minimumSeats', { min: String(minimumSeats) })
    } else if (hasMaximumLimit) {
      return t('checkout.seats.maximumSeats', { max: String(maximumSeats) })
    }
    return null
  }, [minimumSeats, hasMaximumLimit, maximumSeats, t])

  return (
    <div className="flex flex-col gap-6">
      {/* Total Amount Display */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-light text-gray-900 dark:text-white">
          {formatCurrency('compact', locale)(netAmount, currency)}
        </h1>
        <p className="dark:text-polar-400 text-sm text-gray-500">
          {t('checkout.seats.perSeat', {
            price: formatCurrency('compact', locale)(pricePerSeat, currency),
          })}
        </p>
      </div>

      {/* Seat Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-lg">{t('checkout.seats.numberOfSeats')}</label>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleUpdateSeats(displaySeats - 1)}
            disabled={displaySeats <= minimumSeats || isUpdating}
            className="dark:hover:bg-polar-800 dark:hover:border-polar-800 dark:border-polar-700 h-10 w-10 rounded-full border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
            aria-label={t('checkout.seats.decreaseSeats')}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
          </Button>
          <input
            type="text"
            inputMode="numeric"
            disabled={isUpdating}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            min={minimumSeats}
            max={hasMaximumLimit ? maximumSeats : undefined}
            className="dark:hover:bg-polar-800 group dark:border-polar-700 relative max-w-24 min-w-14 rounded-xl border-gray-200 px-3 py-1.5 text-center text-2xl font-light text-gray-900 tabular-nums transition-all hover:bg-gray-100 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 focus-visible:ring-2 focus-visible:ring-blue-100 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-white dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleUpdateSeats(displaySeats + 1)}
            disabled={
              (hasMaximumLimit && displaySeats >= maximumSeats) || isUpdating
            }
            className="dark:hover:bg-polar-800 dark:hover:border-polar-800 dark:border-polar-700 h-10 w-10 rounded-full border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
            aria-label={t('checkout.seats.increaseSeats')}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
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

      <MeteredPricesDisplay checkout={checkout} locale={locale} />
    </div>
  )
}

export default CheckoutSeatSelector
