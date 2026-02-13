'use client'

import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useCallback, useState } from 'react'

const XIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

interface CheckoutDiscountInputProps {
  checkout: CheckoutPublic
  update: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
}

export const CheckoutDiscountInput = ({
  checkout,
  update,
}: CheckoutDiscountInputProps) => {
  const [discountCode, setDiscountCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const hasDiscount = !!checkout.discount

  const addDiscountCode = useCallback(async () => {
    if (!discountCode) return
    setError(null)
    try {
      await update({ discountCode })
    } catch (e) {
      setError('Invalid discount code')
    }
  }, [update, discountCode])

  const removeDiscountCode = useCallback(async () => {
    setError(null)
    try {
      await update({ discountCode: null })
      setDiscountCode('')
    } catch {}
  }, [update])

  if (!checkout.allowDiscountCodes || !checkout.isDiscountApplicable) {
    return null
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-row items-center justify-between text-sm">
        <span>Discount code</span>
      </label>
      <div className="relative">
        <Input
          type="text"
          autoComplete="off"
          value={hasDiscount ? checkout.discount?.code || '' : discountCode}
          onChange={(e) => setDiscountCode(e.target.value)}
          disabled={hasDiscount}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            addDiscountCode()
          }}
          placeholder="Enter code"
        />
        <div className="absolute inset-y-0 right-1 z-10 flex items-center">
          {!hasDiscount && discountCode && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addDiscountCode}
            >
              Apply
            </Button>
          )}
          {hasDiscount && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={removeDiscountCode}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
