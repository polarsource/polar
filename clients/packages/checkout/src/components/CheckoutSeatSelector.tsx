'use client'

import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useState } from 'react'

export interface CheckoutSeatSelectorProps {
  checkout: CheckoutPublic
  update: (body: CheckoutUpdatePublic) => Promise<CheckoutPublic>
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
  const pricePerSeat = productPrice.pricePerSeat || 0
  const totalAmount = checkout.totalAmount
  const currency = productPrice.priceCurrency || 'usd'

  const handleUpdateSeats = async (newSeats: number) => {
    if (newSeats < 1 || isUpdating) return

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
    if (!isNaN(newSeats) && newSeats >= 1 && newSeats !== seats) {
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
        <h1 className="text-3xl font-light">
          {formatCurrencyAndAmount(totalAmount, currency, 0)}
        </h1>
        <p className="dark:text-polar-400 text-sm text-gray-500">
          {formatCurrencyAndAmount(pricePerSeat, currency, 0)} per seat
        </p>
      </div>

      {/* Seat Selector */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="dark:text-polar-300 text-sm font-medium text-gray-600">
            Number of seats
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleUpdateSeats(seats - 1)}
              disabled={seats <= 1 || isUpdating || isEditing}
              className="h-9 w-9 rounded-full"
              aria-label="Decrease seats"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
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
                className="h-auto min-w-[3rem] max-w-[4rem] py-1 text-center text-2xl font-light tabular-nums"
              />
            ) : (
              <button
                type="button"
                onClick={handleSeatClick}
                disabled={isUpdating}
                className="dark:text-polar-50 dark:hover:bg-polar-800 min-w-[3rem] cursor-text rounded-lg px-2 py-1 text-center text-2xl font-light tabular-nums transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Click to edit seat count"
              >
                {seats}
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleUpdateSeats(seats + 1)}
              disabled={isUpdating || isEditing}
              className="h-9 w-9 rounded-full"
              aria-label="Increase seats"
            >
              <svg
                className="h-4 w-4"
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
        </div>
      </div>
    </div>
  )
}

export default CheckoutSeatSelector
