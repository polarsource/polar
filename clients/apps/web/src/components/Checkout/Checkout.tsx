'use client'

import { DISTINCT_ID_COOKIE } from '@/experiments/constants'
import { useCheckoutConfirmedRedirect } from '@/hooks/checkout'
import { usePostHog } from '@/hooks/posthog'
import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import { getServerURL } from '@/utils/api'
import { useCheckoutFulfillmentListener } from '@polar-sh/checkout/hooks'
import { useCheckout, useCheckoutForm } from '@polar-sh/checkout/providers'
import { ClientResponseError, type schemas } from '@polar-sh/client'
import type { AcceptedLocale } from '@polar-sh/i18n'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckoutEmbedView } from './CheckoutEmbedView'
import { CheckoutFullPageView } from './CheckoutFullPageView'

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
  const isPaymentRequired = checkout.is_payment_required
  const shouldBlockCheckout =
    // Always show when organization is denied, regardless of payment required or not
    paymentStatus?.organization_status === 'denied' ||
    (isPaymentRequired && !isPaymentReady)

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

  const viewProps = {
    checkout,
    form,
    update,
    confirm,
    loading,
    loadingLabel: label,
    theme,
    themePreset,
    shouldBlockCheckout,
    organizationStatus: paymentStatus?.organization_status,
    isUpdatePending,
    locale,
  }

  if (embed) {
    return <CheckoutEmbedView {...viewProps} />
  }

  return <CheckoutFullPageView {...viewProps} />
}

export default Checkout
