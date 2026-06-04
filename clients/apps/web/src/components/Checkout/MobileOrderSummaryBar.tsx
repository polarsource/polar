'use client'

import { CheckoutHeroPrice } from '@polar-sh/checkout/components'
import type { ProductCheckoutPublic } from '@polar-sh/checkout/guards'
import { formatCurrency } from '@polar-sh/currency'
import { type AcceptedLocale, useTranslations } from '@polar-sh/i18n'
import { ChevronDown } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

interface MobileOrderSummaryBarProps {
  checkout: ProductCheckoutPublic
  locale: AcceptedLocale
  hasTrial: boolean
  isOpen: boolean
  onToggle: () => void
}

export const MobileOrderSummaryBar = ({
  checkout,
  locale,
  hasTrial,
  isOpen,
  onToggle,
}: MobileOrderSummaryBarProps) => {
  const t = useTranslations(locale)

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={twMerge(
        'dark:border-polar-700 dark:bg-polar-800 -mx-4 flex items-center justify-between gap-x-4 border-y border-gray-200 bg-gray-50 px-4 py-4 text-sm md:hidden',
      )}
    >
      <span className="flex items-center gap-x-2 font-medium whitespace-nowrap text-gray-900 dark:text-white">
        {t('checkout.pricing.orderSummary')}
        <ChevronDown
          size={16}
          className="transition-transform duration-200"
          style={{ transform: `rotate(${isOpen ? 180 : 0}deg)` }}
        />
      </span>
      <span className="flex flex-col items-end text-right whitespace-nowrap text-gray-900 dark:text-white">
        {hasTrial ? (
          <CheckoutHeroPrice checkout={checkout} locale={locale} compact />
        ) : (
          <span className="font-semibold">
            {formatCurrency('standard', locale)(
              checkout.total_amount ?? 0,
              checkout.currency ?? checkout.product_price.price_currency,
            )}
          </span>
        )}
      </span>
    </button>
  )
}
