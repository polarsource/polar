'use client'

import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useState } from 'react'
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

  // Check if the product has seat-based pricing
  const productPrice = checkout.productPrice
  const isSeatBased = productPrice.amountType === 'seat_based'

  if (!isSeatBased) {
    return null
  }

  const seats = checkout.seats || 1
  const netAmount = checkout.netAmount || 0
  const currency = productPrice.priceCurrency
  const pricePerSeat = checkout.pricePerSeat || 0

  const handleUpdateSeats = async (newSeats: number) => {
    if (newSeats < 1 || newSeats > 1000 || isUpdating) return

    setIsUpdating(true)
    try {
      await update({ seats: newSeats } as CheckoutUpdatePublic)
    } catch (error) {
      console.error('Failed to update seats:', error)
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
      newSeats >= 1 &&
      newSeats <= 1000 &&
      newSeats !== seats
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
    setInputValue(seats.toString())
  }

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
            onClick={() => handleUpdateSeats(seats - 1)}
            disabled={seats <= 1 || isUpdating || isEditing}
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
              min={1}
              max={1000}
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
              <span>{seats}</span>
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleUpdateSeats(seats + 1)}
            disabled={seats >= 1000 || isUpdating || isEditing}
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
      </div>

      <MeteredPricesDisplay checkout={checkout} />
    </div>
  )
}

export default CheckoutSeatSelector
