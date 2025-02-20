'use client'

import { CONFIG } from '@/utils/config'
import {
  CheckoutForm,
  CheckoutPricing,
  CheckoutProductSwitcher,
} from '@polar-sh/checkout/components'
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { useCheckoutFulfillmentListener } from '@polar-sh/checkout/hooks'
import { useCheckout, useCheckoutForm } from '@polar-sh/checkout/providers'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import ShadowBox, {
  ShadowBoxOnMd,
} from '@polar-sh/ui/components/atoms/ShadowBox'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { CheckoutCard } from './CheckoutCard'
import CheckoutProductInfo from './CheckoutProductInfo'

export interface CheckoutProps {
  embed?: boolean
  theme?: 'light' | 'dark'
}

const Checkout = ({ embed: _embed, theme: _theme }: CheckoutProps) => {
  const { client } = useCheckout()
  const {
    checkout,
    form,
    update,
    confirm: _confirm,
    loading: confirmLoading,
    loadingLabel,
  } = useCheckoutForm()
  const embed = _embed === true
  const { resolvedTheme } = useTheme()
  const theme = _theme || (resolvedTheme as 'light' | 'dark')

  const router = useRouter()
  const [fullLoading, setFullLoading] = useState(false)
  const loading = useMemo(
    () => confirmLoading || fullLoading,
    [confirmLoading, fullLoading],
  )
  const [listenFulfillment, fullfillmentLabel] = useCheckoutFulfillmentListener(
    client,
    checkout,
  )
  const label = useMemo(
    () => fullfillmentLabel || loadingLabel,
    [fullfillmentLabel, loadingLabel],
  )

  const confirm = useCallback(
    async (
      data: CheckoutConfirmStripe,
      stripe: Stripe | null,
      elements: StripeElements | null,
    ) => {
      setFullLoading(true)
      let confirmedCheckout: CheckoutPublicConfirmed
      try {
        confirmedCheckout = await _confirm(data, stripe, elements)
      } catch (error) {
        setFullLoading(false)
        throw error
      }

      if (checkout.embedOrigin) {
        PolarEmbedCheckout.postMessage(
          {
            event: 'confirmed',
          },
          checkout.embedOrigin,
        )
      }

      const parsedURL = new URL(confirmedCheckout.successUrl)
      const isInternalURL = confirmedCheckout.successUrl.startsWith(
        CONFIG.FRONTEND_BASE_URL,
      )

      if (isInternalURL) {
        if (embed) {
          parsedURL.searchParams.set('embed', 'true')
          if (theme) {
            parsedURL.searchParams.set('theme', theme)
          }
        }
      }

      parsedURL.searchParams.set(
        'customer_session_token',
        confirmedCheckout.customerSessionToken,
      )

      // For external success URL, make sure the checkout is processed before redirecting
      // It ensures the user will have an up-to-date status when they are redirected,
      // especially if the external URL doesn't implement proper webhook handling
      if (!isInternalURL) {
        await listenFulfillment()
      }

      if (checkout.embedOrigin) {
        PolarEmbedCheckout.postMessage(
          {
            event: 'success',
            successURL: parsedURL.toString(),
            redirect: !isInternalURL,
          },
          checkout.embedOrigin,
        )
      }

      if (isInternalURL || !embed) {
        router.push(parsedURL.toString())
      }

      return confirmedCheckout
    },
    [checkout, _confirm, embed, listenFulfillment, router, theme],
  )

  if (embed) {
    return (
      <ShadowBox className="dark:bg-polar-900 flex flex-col gap-y-12 bg-white">
        <ShadowBox className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-6 rounded-3xl bg-gray-50">
          <CheckoutProductSwitcher checkout={checkout} update={update} />
          <CheckoutPricing checkout={checkout} update={update} />
        </ShadowBox>
        <CheckoutForm
          form={form}
          checkout={checkout}
          update={update}
          confirm={confirm}
          loading={loading}
          loadingLabel={label}
          theme={theme}
        />
      </ShadowBox>
    )
  }

  return (
    <ShadowBoxOnMd className="md:dark:border-polar-700 dark:divide-polar-700 grid w-full auto-cols-fr grid-flow-row auto-rows-max gap-y-24 divide-transparent overflow-hidden md:grid-flow-col md:grid-rows-1 md:items-stretch md:gap-y-0 md:divide-x md:border md:border-gray-100 md:p-0">
      <div className="flex flex-col gap-y-8 md:p-12">
        <CheckoutProductInfo
          organization={checkout.organization}
          product={checkout.product}
        />
        <CheckoutCard checkout={checkout} update={update} />
        <CheckoutProductSwitcher checkout={checkout} update={update} />
      </div>
      <div className="flex flex-col gap-y-8 md:p-12 lg:p-20">
        <CheckoutForm
          form={form}
          checkout={checkout}
          update={update}
          confirm={confirm}
          loading={loading}
          loadingLabel={label}
          theme={theme}
        />
      </div>
    </ShadowBoxOnMd>
  )
}

export default Checkout
