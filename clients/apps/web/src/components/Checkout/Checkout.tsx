'use client'

import type { ExperimentVariant } from '@/experiments'
import { useCheckoutConfirmedRedirect } from '@/hooks/checkout'
import { usePostHog } from '@/hooks/posthog'
import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import {
  CheckoutForm,
  CheckoutProductSwitcher,
  CheckoutPWYWForm,
} from '@polar-sh/checkout/components'
import {
  hasProductCheckout,
  type ProductCheckoutPublic,
} from '@polar-sh/checkout/guards'
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
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckoutCard } from './CheckoutCard'
import CheckoutProductInfo from './CheckoutProductInfo'

export interface CheckoutProps {
  embed?: boolean
  theme?: 'light' | 'dark'
  merchantAvatarVariant?: ExperimentVariant<'checkout_merchant_avatar_experiment'>
}

const Checkout = ({
  embed: _embed,
  theme: _theme,
  merchantAvatarVariant = 'control',
}: CheckoutProps) => {
  const { client } = useCheckout()
  const {
    checkout,
    form,
    update: _update,
    confirm: _confirm,
    loading: confirmLoading,
    loadingLabel,
    isUpdatePending,
  } = useCheckoutForm()
  const embed = _embed === true
  const { resolvedTheme } = useTheme()
  const theme = _theme || (resolvedTheme as 'light' | 'dark')
  const posthog = usePostHog()

  const themePreset = getThemePreset(checkout.organization.slug, theme)
  const hasTrackedOpen = useRef(false)

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
    if (hasTrackedOpen.current) return
    hasTrackedOpen.current = true
    posthog.capture('storefront:subscriptions:checkout:open', {
      organization_slug: checkout.organization.slug,
      product_id: checkout.productId,
      amount: checkout.amount,
      embed,
    })
  }, [
    checkout.organization.slug,
    checkout.productId,
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
        product_id: checkout.productId,
      })
    }
  }, [
    paymentStatus,
    shouldBlockCheckout,
    checkout.organization.slug,
    paymentStatus?.organization_status,
    checkout.productId,
    posthog,
  ])

  const PaymentNotReadyBanner = () => {
    if (!shouldBlockCheckout) return null

    const isDenied = paymentStatus?.organization_status === 'denied'

    return (
      <Alert color="red">
        <div className="flex flex-col gap-y-2 p-2">
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
      <ShadowBox className="dark:md:bg-polar-900 flex flex-col gap-y-12 divide-gray-200 overflow-hidden rounded-3xl md:bg-white dark:divide-transparent">
        <PaymentNotReadyBanner />
        {hasProductCheckout(checkout) && (
          <>
            <CheckoutProductSwitcher
              checkout={checkout}
              update={
                update as (
                  data: CheckoutUpdatePublic,
                ) => Promise<ProductCheckoutPublic>
              }
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
          </>
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
          isUpdatePending={isUpdatePending}
        />
      </ShadowBox>
    )
  }

  return (
    <ShadowBoxOnMd className="md:dark:border-polar-700 dark:md:bg-polar-900 grid w-full auto-cols-fr grid-flow-row auto-rows-max gap-y-12 divide-gray-200 rounded-3xl md:grid-flow-col md:grid-rows-1 md:items-stretch md:gap-y-24 md:divide-x md:overflow-hidden md:border md:border-gray-100 md:bg-white md:p-0 md:shadow-xs dark:divide-transparent">
      <div className="md:dark:bg-polar-950 flex flex-col gap-y-8 md:bg-gray-50 md:p-12">
        {checkout.returnUrl && (
          <Link
            href={checkout.returnUrl}
            className="dark:text-polar-500 flex flex-row items-center gap-x-4 px-4 py-2 text-gray-500"
          >
            <ArrowBackOutlined fontSize="inherit" />
            <span>Back to {checkout.organization.name}</span>
          </Link>
        )}
        {hasProductCheckout(checkout) && (
          <>
            <CheckoutProductInfo
              organization={checkout.organization}
              product={checkout.product}
              merchantAvatarVariant={merchantAvatarVariant}
            />
            <CheckoutProductSwitcher
              checkout={checkout}
              update={
                update as (
                  data: CheckoutUpdatePublic,
                ) => Promise<ProductCheckoutPublic>
              }
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
              update={
                update as (
                  data: CheckoutUpdatePublic,
                ) => Promise<ProductCheckoutPublic>
              }
            />
          </>
        )}
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
          isUpdatePending={isUpdatePending}
        />
      </div>
    </ShadowBoxOnMd>
  )
}

export default Checkout
