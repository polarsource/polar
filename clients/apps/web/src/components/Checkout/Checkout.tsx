'use client'

import { useExperiment } from '@/experiments/client'
import { DISTINCT_ID_COOKIE } from '@/experiments/constants'
import { useCheckoutConfirmedRedirect } from '@/hooks/checkout'
import { usePostHog } from '@/hooks/posthog'
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport'
import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import { getServerURL } from '@/utils/api'
import { isOrderSummaryCollapsible } from '@/utils/checkout'
import { getResizedImage } from '@/utils/getResizedImage'
import { ArrowLeft } from 'lucide-react'
import {
  CheckoutForm,
  CheckoutHeroPrice,
  CheckoutPricingBreakdown,
  CheckoutProductSwitcher,
  CheckoutPWYWForm,
  CheckoutSeatSelector,
  CheckoutUnitSelector,
} from '@polar-sh/checkout/components'
import {
  getSeatPrice,
  getUnitPrice,
  hasProductCheckout,
  type ProductCheckoutPublic,
} from '@polar-sh/checkout/guards'
import { useCheckoutFulfillmentListener } from '@polar-sh/checkout/hooks'
import { useCheckout, useCheckoutForm } from '@polar-sh/checkout/providers'
import { ClientResponseError, type schemas } from '@polar-sh/client'
import { AcceptedLocale } from '@polar-sh/i18n'
import { Alert, Avatar } from '@polar-sh/orbit'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckoutCollapsibleOrderSummary } from './CheckoutCollapsibleOrderSummary'
import { CheckoutDiscountInput } from './CheckoutDiscountInput'
import { CheckoutOrderSummary } from './CheckoutOrderSummary'

const PaymentNotReadyBanner = ({
  organizationStatus,
  organizationName,
}: {
  organizationStatus: string | undefined
  organizationName: string
}) => {
  const isTestMode = organizationStatus === 'created'

  return (
    <Alert
      variant={isTestMode ? 'info' : 'danger'}
      title={
        isTestMode
          ? `${organizationName} is in test mode`
          : 'Payments are currently unavailable'
      }
      description={
        isTestMode
          ? `You can test checkout with free products or 100% discount orders.`
          : `${organizationName} doesn't allow payments.`
      }
    />
  )
}

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

  const hasActiveTrial = Boolean(
    checkout.active_trial_interval && checkout.active_trial_interval_count,
  )
  const { isTreatment } = useExperiment('checkout_trial_due_today', {
    trackExposure: hasActiveTrial,
  })
  const trialDueTodayExperiment = hasActiveTrial && isTreatment

  const { isTreatment: ctaColorExperiment } = useExperiment(
    'checkout_cta_primary_color',
    { trackExposure: !embed },
  )

  const isMobileViewport = useIsMobileViewport()
  const collapsibleOrderSummary =
    hasProductCheckout(checkout) && isOrderSummaryCollapsible(checkout)
  const { isTreatment: collapsedOrderSummaryExperiment } = useExperiment(
    'checkout_collapsed_order_summary',
    { trackExposure: !embed && isMobileViewport && collapsibleOrderSummary },
  )
  const collapsedOrderSummary =
    collapsibleOrderSummary && collapsedOrderSummaryExperiment

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
      getServerURL(`/v1/checkouts/client/${checkout.client_secret}/opened`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distinct_id: distinctId }),
      },
    ).catch(() => {
      // Silently ignore - don't affect checkout experience
    })
  }, [checkout.client_secret, posthog])

  const themePreset = getThemePreset(theme)

  const { data: paymentStatus } = useOrganizationPaymentStatus(
    checkout.organization.id,
  )

  const isPaymentReady = paymentStatus?.payment_ready ?? true // Default to true while loading
  const shouldBlockCheckout = !isPaymentReady
  const disableCheckout =
    shouldBlockCheckout &&
    (paymentStatus?.organization_status === 'denied' ||
      checkout.is_payment_required)

  // Track payment not ready state
  useEffect(() => {
    if (shouldBlockCheckout && paymentStatus) {
      posthog.capture('storefront:subscriptions:payment_not_ready:view', {
        organization_slug: checkout.organization.slug,
        organization_status: paymentStatus?.organization_status,
        product_id: checkout.product_id,
      })
    }
  }, [
    paymentStatus,
    shouldBlockCheckout,
    checkout.organization.slug,
    paymentStatus?.organization_status,
    checkout.product_id,
    posthog,
  ])

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
    async (data: schemas['CheckoutUpdatePublic']) => {
      try {
        return await _update(data)
      } catch (error) {
        if (
          error instanceof ClientResponseError &&
          error.response.status === 410
        ) {
          window.location.reload()
        }
        throw error
      }
    },
    [_update],
  )

  const confirm = useCallback(
    async (
      data: schemas['CheckoutConfirmStripe'],
      stripe: Stripe | null,
      elements: StripeElements | null,
    ) => {
      setFullLoading(true)
      let confirmedCheckout: schemas['CheckoutPublicConfirmed']
      try {
        confirmedCheckout = await _confirm(data, stripe, elements)
      } catch (error) {
        if (
          error instanceof ClientResponseError &&
          error.response.status === 410
        ) {
          window.location.reload()
        }
        setFullLoading(false)
        throw error
      }

      await checkoutConfirmedRedirect(
        confirmedCheckout,
        confirmedCheckout.customer_session_token,
      )

      return confirmedCheckout
    },
    [_confirm, checkoutConfirmedRedirect],
  )

  if (embed) {
    return (
      <ShadowBox className="dark:md:bg-polar-900 flex flex-col gap-y-12 divide-gray-200 overflow-hidden rounded-3xl md:bg-white dark:divide-transparent">
        {shouldBlockCheckout && (
          <PaymentNotReadyBanner
            organizationStatus={paymentStatus?.organization_status}
            organizationName={checkout.organization.name}
          />
        )}
        {hasProductCheckout(checkout) && (
          <>
            <CheckoutProductSwitcher
              checkout={checkout}
              update={
                update as (
                  data: schemas['CheckoutUpdatePublic'],
                ) => Promise<ProductCheckoutPublic>
              }
              themePreset={themePreset}
              locale={locale}
            />
            {checkout.product_price.amount_type === 'custom' && (
              <CheckoutPWYWForm
                checkout={checkout}
                update={update}
                productPrice={
                  checkout.product_price as schemas['ProductPriceCustom']
                }
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
          disabled={disableCheckout}
          isUpdatePending={isUpdatePending}
          locale={locale}
          embed
          beforeSubmit={
            hasProductCheckout(checkout) && !checkout.is_free_product_price ? (
              <div className="flex flex-col gap-4">
                {!!getSeatPrice(checkout) && (
                  <CheckoutSeatSelector
                    checkout={checkout}
                    updateCheckout={update}
                    locale={locale}
                  />
                )}
                {!!getUnitPrice(checkout) && (
                  <CheckoutUnitSelector
                    checkout={checkout}
                    updateCheckout={update}
                    locale={locale}
                  />
                )}
                {checkout.active_trial_interval &&
                  checkout.active_trial_interval_count && (
                    <>
                      <CheckoutHeroPrice checkout={checkout} locale={locale} />
                      <hr className="dark:border-polar-700 border-gray-200" />
                    </>
                  )}
                <CheckoutPricingBreakdown
                  checkout={checkout}
                  locale={locale}
                  trialDueTodayExperiment={trialDueTodayExperiment}
                />
                <CheckoutDiscountInput
                  checkout={checkout}
                  update={update}
                  locale={locale}
                />
              </div>
            ) : undefined
          }
        />
      </ShadowBox>
    )
  }

  const orgHeader = (
    <div className="flex flex-row items-center gap-x-4">
      {checkout.return_url && (
        <Link
          href={checkout.return_url}
          className="dark:text-polar-500 text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
      )}
      <div className="flex flex-row items-center gap-x-2">
        <Avatar
          avatar_url={getResizedImage(checkout.organization.avatar_url, 24)}
          name={checkout.organization.name}
          className="h-6 w-6"
          width={24}
          height={24}
        />
        <span className="text-sm dark:text-white">
          {checkout.organization.name}
        </span>
      </div>
    </div>
  )

  return (
    <div className="md:grid md:min-h-screen md:grid-cols-2">
      <div className="md:flex md:justify-end">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-y-6 px-4 py-6 pb-2 md:mx-0 md:py-12 md:pr-12 md:pl-4">
          {orgHeader}
          {collapsedOrderSummary && hasProductCheckout(checkout) ? (
            <CheckoutCollapsibleOrderSummary
              checkout={checkout}
              update={update}
              themePreset={themePreset}
              locale={locale}
              trialDueTodayExperiment={trialDueTodayExperiment}
            />
          ) : (
            <div className="flex flex-col gap-y-8 md:sticky md:top-8">
              {hasProductCheckout(checkout) && (
                <CheckoutOrderSummary
                  checkout={checkout}
                  update={update}
                  themePreset={themePreset}
                  locale={locale}
                  trialDueTodayExperiment={trialDueTodayExperiment}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <div className="dark:md:bg-polar-900 md:bg-white">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-y-8 px-4 py-6 md:mx-0 md:py-12 md:pr-4 md:pl-12">
          {shouldBlockCheckout && (
            <PaymentNotReadyBanner
              organizationStatus={paymentStatus?.organization_status}
              organizationName={checkout.organization.name}
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
            ctaColorExperiment={ctaColorExperiment}
            disabled={disableCheckout}
            isUpdatePending={isUpdatePending}
            locale={locale}
          />
        </div>
      </div>
    </div>
  )
}

export default Checkout
