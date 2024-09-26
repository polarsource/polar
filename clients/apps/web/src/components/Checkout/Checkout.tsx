'use client'

import { api } from '@/utils/api'
import {
  CheckoutConfirmStripe,
  CheckoutPublic,
  CheckoutUpdatePublic,
  Organization,
} from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useCallback, useState } from 'react'
import { CheckoutForm } from './CheckoutForm'
import { CheckoutInfo } from './CheckoutInfo'

export interface CheckoutProps {
  organization: Organization
  checkout: CheckoutPublic
}

export const Checkout = ({
  checkout: _checkout,
  organization,
}: CheckoutProps) => {
  const [checkout, setCheckout] = useState(_checkout)

  const onCheckoutUpdate = useCallback(
    async (body: CheckoutUpdatePublic): Promise<CheckoutPublic> => {
      const updatedCheckout = await api.checkouts.clientUpdate({
        clientSecret: checkout.client_secret,
        body,
      })
      setCheckout(updatedCheckout)
      return updatedCheckout
    },
    [checkout],
  )

  const onCheckoutConfirm = useCallback(
    async (body: CheckoutConfirmStripe): Promise<CheckoutPublic> => {
      const updatedCheckout = await api.checkouts.clientConfirm({
        clientSecret: checkout.client_secret,
        body,
      })
      setCheckout(updatedCheckout)
      return updatedCheckout
    },
    [checkout],
  )

  return (
    <ShadowBox className="dark:border-polar-700 dark:divide-polar-700 flex w-full max-w-7xl flex-row items-stretch divide-x divide-gray-100 border border-gray-100 p-0">
      <CheckoutInfo
        organization={organization}
        checkout={checkout}
        onCheckoutUpdate={onCheckoutUpdate}
      />
      <CheckoutForm
        checkout={checkout}
        onCheckoutUpdate={onCheckoutUpdate}
        onCheckoutConfirm={onCheckoutConfirm}
      />
    </ShadowBox>
  )
}
