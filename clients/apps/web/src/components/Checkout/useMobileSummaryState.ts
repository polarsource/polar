'use client'

import { hasProductCheckout } from '@polar-sh/checkout/guards'
import type { schemas } from '@polar-sh/client'
import { useCallback, useState } from 'react'

type MobileSummaryMode = 'full' | 'collapsed-bar'

export interface MobileSummaryState {
  mode: MobileSummaryMode
  collapses: boolean
  hasTrial: boolean
  isOpen: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useMobileSummaryState = (
  checkout: schemas['CheckoutPublic'],
): MobileSummaryState => {
  const isSeatBased =
    hasProductCheckout(checkout) &&
    checkout.product_price.amount_type === 'seat_based'
  const isPWYW =
    hasProductCheckout(checkout) &&
    checkout.product_price.amount_type === 'custom'
  const hasTrial =
    !!checkout.active_trial_interval && !!checkout.active_trial_interval_count

  const mode: MobileSummaryMode =
    isSeatBased || isPWYW || checkout.is_free_product_price
      ? 'full'
      : 'collapsed-bar'
  const collapses = mode === 'collapsed-bar'

  const [isOpen, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((o) => !o), [])

  return { mode, collapses, hasTrial, isOpen, setOpen, toggle }
}
