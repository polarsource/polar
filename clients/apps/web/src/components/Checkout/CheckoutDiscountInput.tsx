'use client'

import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useCallback, useEffect, useState } from 'react'

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
  locale?: AcceptedLocale
}

export const CheckoutDiscountInput = ({
  checkout,
  update,
  locale = DEFAULT_LOCALE,
}: CheckoutDiscountInputProps) => {
  const t = useTranslations(locale)
  const [discountCode, setDiscountCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAddingDiscount, setIsAddingDiscount] = useState(false)

  const hasDiscount = !!checkout.discount

  useEffect(() => {
    if (hasDiscount) {
      setDiscountCode('')
      setError(null)
    }
  }, [hasDiscount])

  const addDiscountCode = useCallback(async () => {
    if (!discountCode) return
    setError(null)
    try {
      await update({ discountCode })
    } catch {
      setError(t('checkout.form.fieldRequired'))
    }
  }, [update, discountCode, t])

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

  if (!isAddingDiscount && !hasDiscount) {
    return (
      // <button
      //   className="dark:bg-polar-800 dark:text-polar-500 dark:hover:bg-polar-700 dark:hover:text-polar-400 h-10 cursor-pointer rounded-lg bg-gray-50 px-3 text-center text-gray-500 hover:bg-gray-100 hover:text-gray-600 md:text-sm"
      //   onClick={() => setIsAddingDiscount(true)}
      // >
      //   {t('checkout.form.discountCode')}
      // </button>
      <Button
        variant="secondary"
        onClick={() => setIsAddingDiscount(true)}
        className="dark:text-polar-500 dark:hover:text-polar-400 text-gray-600"
      >
        {t('checkout.form.discountCode')}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Input
          type="text"
          autoComplete="off"
          autoFocus
          placeholder={t('checkout.form.discountCode')}
          value={hasDiscount ? checkout.discount?.code || '' : discountCode}
          onChange={(e) => setDiscountCode(e.target.value)}
          disabled={hasDiscount}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            addDiscountCode()
          }}
          onBlur={() => {
            if (!discountCode && !hasDiscount) {
              setIsAddingDiscount(false)
            }
          }}
        />
        <div className="absolute inset-y-0 right-1 z-10 flex items-center">
          {!hasDiscount && discountCode && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addDiscountCode}
            >
              {t('checkout.form.apply')}
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
