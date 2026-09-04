'use client'

import { CheckoutHeroPrice } from '@polar-sh/checkout/components'
import { useTranslations } from '@polar-sh/i18n'
import { cn } from '@polar-sh/ui/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import {
  CheckoutOrderSummary,
  type CheckoutOrderSummaryProps,
} from './CheckoutOrderSummary'

export const CheckoutCollapsibleOrderSummary = (
  props: CheckoutOrderSummaryProps,
) => {
  const { checkout, locale } = props
  const t = useTranslations(locale)
  const [expanded, setExpanded] = useState(false)
  const summaryId = useId()

  return (
    <div className="flex flex-col gap-y-8 md:sticky md:top-8">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={summaryId}
        onClick={() => setExpanded((value) => !value)}
        className="dark:border-polar-700 dark:bg-polar-950 -mx-4 flex cursor-pointer flex-row items-center justify-between gap-x-4 border-y border-gray-200 bg-gray-50 px-4 py-4 text-left md:hidden"
      >
        <span className="flex flex-row items-center gap-x-2 font-medium">
          {t('checkout.orderSummary')}
          <ChevronDown
            size={16}
            className={cn('transition-transform', expanded && 'rotate-180')}
          />
        </span>
        <span className="shrink-0 text-right font-medium">
          <CheckoutHeroPrice checkout={checkout} locale={locale} compact />
        </span>
      </button>
      <div
        id={summaryId}
        className={cn('flex-col gap-y-8', expanded ? 'flex' : 'hidden md:flex')}
      >
        <CheckoutOrderSummary {...props} />
      </div>
    </div>
  )
}
