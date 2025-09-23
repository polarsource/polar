'use client'

import { useCheckoutConfirmedRedirect } from '@/hooks/checkout'
import { usePostHog } from '@/hooks/posthog'
import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import {
  CheckoutForm,
  CheckoutProductSwitcher,
  CheckoutPWYWForm,
} from '@polar-sh/checkout/components'
import { useCheckoutFulfillmentListener } from '@polar-sh/checkout/hooks'
import { useCheckout, useCheckoutForm } from '@polar-sh/checkout/providers'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import { ProductPriceCustom } from '@polar-sh/sdk/models/components/productpricecustom.js'
import { ExpiredCheckoutError } from '@polar-sh/sdk/models/errors/expiredcheckouterror'
import Alert from '@polar-sh/ui/components/atoms/Alert'
import ShadowBox, {
  ShadowBoxOnMd,
} from '@polar-sh/ui/components/atoms/ShadowBox'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
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
    update: _update,
    confirm: _confirm,
    loading: confirmLoading,
    loadingLabel,
    updateIsPending,
  } = useCheckoutForm()
  const embed = _embed === true
  const { resolvedTheme } = useTheme()
  const theme = _theme || (resolvedTheme as 'light' | 'dark')
  const posthog = usePostHog()

  const themePreset = useThemePreset(
    checkout.organization.slug === 'midday' ? 'midday' : 'polar',
    theme,
  )

  // Check organization payment readiness (account verification only for checkout)
  const { data: paymentStatus } = useOrganizationPaymentStatus(
    checkout.organization.id,
    true, // enabled
    true, // accountVerificationOnly - avoid unnecessary product/token checks in checkout
  )

  const isPaymentReady = paymentStatus?.payment_ready ?? true // Default to true while loading
  const isPaymentRequired = checkout.isPaymentRequired
  const shouldBlockCheckout = !isPaymentReady && isPaymentRequired

  // Track checkout page open
  useEffect(() => {
    posthog.capture('storefront:subscriptions:checkout:open', {
      organization_slug: checkout.organization.slug,
      product_id: checkout.product.id,
      amount: checkout.amount,
      embed,
    })
  }, [
    checkout.organization.slug,
    checkout.product.id,
    checkout.amount,
    embed,
    posthog,
  ])

  // Track payment not ready state
  useEffect(() => {
    if (shouldBlockCheckout && paymentStatus) {
      posthog.capture('storefront:subscriptions:payment_not_ready:view', {
        organization_slug: checkout.organization.slug,
        organization_status: paymentStatus?.organization_status,
        product_id: checkout.product.id,
      })
    }
  }, [
    shouldBlockCheckout,
    checkout.organization.slug,
    paymentStatus?.organization_status,
    checkout.product.id,
    posthog,
  ])

  const PaymentNotReadyBanner = () => {
    if (!shouldBlockCheckout) return null

    const isDenied = paymentStatus?.organization_status === 'denied'

    return (
      <Alert color="red">
        <div className="flex flex-col gap-y-2">
          <div className="font-medium">Payments are currently unavailable</div>
          <div className="text-sm">
            {isDenied
              ? `${checkout.organization.name} doesn't allow payments.`
              : `${checkout.organization.name} needs to complete their payment setup before you can make a purchase. You can still test with free products or 100% discount orders.`}
          </div>
        </div>
      </Alert>
    )
  }

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
  const checkoutConfirmedRedirect = useCheckoutConfirmedRedirect(
    embed,
    theme,
    listenFulfillment,
  )

  const update = useCallback(
    async (data: CheckoutUpdatePublic) => {
      try {
        return await _update(data)
      } catch (error) {
        if (error instanceof ExpiredCheckoutError) {
          window.location.reload()
        }
        throw error
      }
    },
    [_update],
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
        if (error instanceof ExpiredCheckoutError) {
          window.location.reload()
        }
        setFullLoading(false)
        throw error
      }

      await checkoutConfirmedRedirect(
        checkout,
        confirmedCheckout.customerSessionToken,
      )

      return confirmedCheckout
    },
    [_confirm, checkout, checkoutConfirmedRedirect],
  )

  if (embed) {
    return (
      <ShadowBox
        className={twMerge(
          themePreset.polar.checkoutInnerWrapper,
          'flex flex-col gap-y-12 overflow-hidden',
        )}
      >
        <PaymentNotReadyBanner />
        <CheckoutProductSwitcher
          checkout={checkout}
          update={update}
          themePreset={themePreset}
        />
        {checkout.productPrice.amountType === 'custom' && (
          <CheckoutPWYWForm
            checkout={checkout}
            update={update}
            productPrice={checkout.productPrice as ProductPriceCustom}
            themePreset={themePreset}
          />
        )}
        <CheckoutForm
          form={form}
          checkout={checkout}
          update={update}
          confirm={confirm}
          loading={loading}
          loadingLabel={label}
          theme={theme}
          themePreset={themePreset}
          disabled={shouldBlockCheckout}
          updateIsPending={updateIsPending}
        />
      </ShadowBox>
    )
  }

  return (
    <ShadowBoxOnMd
      className={twMerge(
        themePreset.polar.checkoutInnerWrapper,
        'md:dark:border-polar-700 grid w-full auto-cols-fr grid-flow-row auto-rows-max gap-y-12 md:grid-flow-col md:grid-rows-1 md:items-stretch md:gap-y-24 md:divide-x md:overflow-hidden md:border md:border-gray-100 md:p-0 md:shadow-sm',
      )}
    >
      <div
        className={twMerge(
          themePreset.polar.checkoutInfoWrapper,
          'flex flex-col gap-y-8 md:p-12',
        )}
      >
        <CheckoutProductInfo
          organization={checkout.organization}
          product={checkout.product}
        />
        <CheckoutProductSwitcher
          checkout={checkout}
          update={update}
          themePreset={themePreset}
        />
        {checkout.productPrice.amountType === 'custom' && (
          <CheckoutPWYWForm
            checkout={checkout}
            update={update}
            productPrice={checkout.productPrice as ProductPriceCustom}
            themePreset={themePreset}
          />
        )}
        <CheckoutCard
          checkout={checkout}
          update={update}
          themePreset={themePreset}
        />
      </div>
      <div className="flex flex-col gap-y-8 md:p-12">
        <PaymentNotReadyBanner />
        <CheckoutForm
          form={form}
          checkout={checkout}
          update={update}
          confirm={confirm}
          loading={loading}
          loadingLabel={label}
          theme={theme}
          themePreset={themePreset}
          disabled={shouldBlockCheckout}
          updateIsPending={updateIsPending}
        />
      </div>
    </ShadowBoxOnMd>
  )
}

export default Checkout
