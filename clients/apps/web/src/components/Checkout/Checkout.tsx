'use client'

import { useExperiment } from '@/experiments/client'
import { DISTINCT_ID_COOKIE } from '@/experiments/constants'
import { useCheckoutConfirmedRedirect } from '@/hooks/checkout'
import { usePostHog } from '@/hooks/posthog'
import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import { getServerURL } from '@/utils/api'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import {
  CheckoutForm,
  CheckoutPricingBreakdown,
  CheckoutProductSwitcher,
  CheckoutPWYWForm,
  CheckoutSeatSelector,
} from '@polar-sh/checkout/components'
import {
  hasProductCheckout,
  type ProductCheckoutPublic,
} from '@polar-sh/checkout/guards'
import { useCheckoutFulfillmentListener } from '@polar-sh/checkout/hooks'
import { useCheckout, useCheckoutForm } from '@polar-sh/checkout/providers'
import { AcceptedLocale } from '@polar-sh/i18n'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import { ProductPriceCustom } from '@polar-sh/sdk/models/components/productpricecustom.js'
import { ExpiredCheckoutError } from '@polar-sh/sdk/models/errors/expiredcheckouterror'
import Alert from '@polar-sh/ui/components/atoms/Alert'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import ShadowBox, {
  ShadowBoxOnMd,
} from '@polar-sh/ui/components/atoms/ShadowBox'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckoutDiscountInput } from './CheckoutDiscountInput'
import CheckoutProductInfo from './CheckoutProductInfo'

export interface CheckoutProps {
  embed?: boolean
  theme?: 'light' | 'dark'
  locale?: AcceptedLocale
}

const Checkout = ({
  embed: _embed,
  theme: _theme,
  locale: _locale,
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
  const locale: AcceptedLocale = _locale || 'en'
  const posthog = usePostHog()

  const { variant: termsExperiment } = useExperiment('checkout_terms')
  const { variant: businessCheckboxExperiment } = useExperiment(
    'checkout_business_checkbox',
  )


  const openedTrackedRef = useRef(false)
  useEffect(() => {
    if (openedTrackedRef.current) return
    openedTrackedRef.current = true

    posthog.capture('storefront:checkout:page:view')

    const cookies = document.cookie.split(';')
    const distinctIdCookie = cookies.find((c) =>
      c.trim().startsWith(`${DISTINCT_ID_COOKIE}=`),
    )
    const distinctId = distinctIdCookie?.split('=')[1]?.trim()

    fetch(
      getServerURL(`/v1/checkouts/client/${checkout.clientSecret}/opened`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distinct_id: distinctId }),
      },
    ).catch(() => {
      // Silently ignore - don't affect checkout experience
    })
  }, [checkout.clientSecret, posthog])

  const themePreset = getThemePreset(theme)

  // Check organization payment readiness (account verification only for checkout)
  const { data: paymentStatus } = useOrganizationPaymentStatus(
    checkout.organization.id,
    true, // enabled
    true, // accountVerificationOnly - avoid unnecessary product/token checks in checkout
  )

  const isPaymentReady = paymentStatus?.payment_ready ?? true // Default to true while loading
  const isPaymentRequired = checkout.isPaymentRequired
  const shouldBlockCheckout = !isPaymentReady && isPaymentRequired

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
              locale={locale}
            />
            {checkout.productPrice.amountType === 'custom' && (
              <CheckoutPWYWForm
                checkout={checkout}
                update={update}
                productPrice={checkout.productPrice as ProductPriceCustom}
                themePreset={themePreset}
                locale={locale}
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
          locale={locale}
          termsExperiment={termsExperiment}
          businessCheckboxExperiment={businessCheckboxExperiment}
        />
      </ShadowBox>
    )
  }

  return (
    <div className="flex w-full flex-col gap-y-6">
      <div className="flex flex-row items-center gap-x-4">
        {checkout.returnUrl && (
          <Link
            href={checkout.returnUrl}
            className="dark:text-polar-500 text-gray-500"
          >
            <ArrowBackOutlined fontSize="small" />
          </Link>
        )}
        <div className="flex flex-row items-center gap-x-3">
          <Avatar
            avatar_url={checkout.organization.avatarUrl}
            name={checkout.organization.name}
            className="h-8 w-8"
          />
          <span className="font-medium dark:text-white">
            {checkout.organization.name}
          </span>
        </div>
      </div>
      <ShadowBoxOnMd className="md:dark:border-polar-700 dark:md:bg-polar-900 grid w-full auto-cols-fr grid-flow-row auto-rows-max gap-y-12 divide-gray-200 rounded-3xl md:grid-flow-col md:grid-rows-1 md:items-stretch md:gap-y-24 md:divide-x md:overflow-clip md:border md:border-gray-100 md:bg-white md:p-0 md:shadow-xs dark:divide-transparent">
        <div className="md:dark:bg-polar-950 md:bg-gray-50 md:p-12">
          <div className="flex flex-col gap-y-8 md:sticky md:top-8">
            {hasProductCheckout(checkout) && (
              <>
                <CheckoutProductInfo
                  organization={checkout.organization}
                  product={checkout.product}
                />
                <CheckoutProductSwitcher
                  checkout={checkout}
                  update={
                    update as (
                      data: CheckoutUpdatePublic,
                    ) => Promise<ProductCheckoutPublic>
                  }
                  themePreset={themePreset}
                  locale={locale}
                />
                {checkout.productPrice.amountType === 'custom' && (
                  <CheckoutPWYWForm
                    checkout={checkout}
                    update={update}
                    productPrice={checkout.productPrice as ProductPriceCustom}
                    themePreset={themePreset}
                    locale={locale}
                  />
                )}
                {!checkout.isFreeProductPrice && (
                  <ShadowBox className="dark:bg-polar-900 dark:border-polar-700 flex flex-col gap-4 rounded-3xl! border border-gray-200 bg-white shadow-xs">
                    {checkout.productPrice.amountType === 'seat_based' && (
                      <CheckoutSeatSelector
                        checkout={checkout}
                        update={
                          update as (
                            data: CheckoutUpdatePublic,
                          ) => Promise<ProductCheckoutPublic>
                        }
                        locale={locale}
                        compact
                      />
                    )}
                    <CheckoutPricingBreakdown
                      checkout={checkout}
                      locale={locale}
                    />
                    <CheckoutDiscountInput
                      checkout={checkout}
                      update={update}
                      locale={locale}
                    />
                  </ShadowBox>
                )}
              </>
            )}
          </div>
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
            locale={locale}
            termsExperiment={termsExperiment}
            businessCheckboxExperiment={businessCheckboxExperiment}
          />
        </div>
      </ShadowBoxOnMd>
    </div>
  )
}

export default Checkout
