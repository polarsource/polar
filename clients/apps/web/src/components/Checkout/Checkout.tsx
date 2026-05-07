'use client'

import { UploadImage } from '@/components/Image/Image'
import { DISTINCT_ID_COOKIE } from '@/experiments/constants'
import { useCheckoutConfirmedRedirect } from '@/hooks/checkout'
import { usePostHog } from '@/hooks/posthog'
import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import { getServerURL } from '@/utils/api'
import { getResizedImage } from '@/utils/getResizedImage'
import { ArrowLeft } from 'lucide-react'
import {
  CheckoutForm,
  CheckoutHeroPrice,
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
import { ClientResponseError, type schemas } from '@polar-sh/client'
import { AcceptedLocale } from '@polar-sh/i18n'
import Alert from '@polar-sh/ui/components/atoms/Alert'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@polar-sh/ui/components/ui/dialog'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Slideshow } from '../Products/Slideshow'
import { CheckoutDiscountInput } from './CheckoutDiscountInput'
import { CheckoutProductDescription } from './CheckoutProductDescription'
import { twMerge } from 'tailwind-merge'

const PaymentNotReadyBanner = ({
  organizationStatus,
  organizationName,
}: {
  organizationStatus: string | undefined
  organizationName: string
}) => {
  const isTestMode = organizationStatus === 'created'

  return (
    <Alert color={isTestMode ? 'gray' : 'red'}>
      <div className="flex flex-col gap-y-1 p-2">
        <div
          className={twMerge(
            'text-sm font-medium',
            isTestMode ? 'text-black dark:text-white' : '',
          )}
        >
          {isTestMode
            ? `${organizationName} is in test mode`
            : 'Payments are currently unavailable'}
        </div>
        <div className="text-sm">
          {isTestMode
            ? `You can test checkout with free products or 100% discount orders.`
            : `${organizationName} doesn't allow payments.`}
        </div>
      </div>
    </Alert>
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
          beforeSubmit={
            hasProductCheckout(checkout) && !checkout.is_free_product_price ? (
              <div className="flex flex-col gap-4">
                {checkout.product_price.amount_type === 'seat_based' && (
                  <CheckoutSeatSelector
                    checkout={checkout}
                    update={update}
                    locale={locale}
                    compact
                  />
                )}
                {checkout.active_trial_interval &&
                  checkout.active_trial_interval_count && (
                    <>
                      <CheckoutHeroPrice checkout={checkout} locale={locale} />
                      <hr className="dark:border-polar-700 border-gray-200" />
                    </>
                  )}
                <CheckoutPricingBreakdown checkout={checkout} locale={locale} />
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

  const hasMedia =
    hasProductCheckout(checkout) && checkout.product.medias.length > 0

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
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-y-8 px-4 py-6 md:mx-0 md:py-12 md:pr-12 md:pl-4">
          {orgHeader}
          <div className="flex flex-col gap-y-8 md:sticky md:top-8">
            {hasProductCheckout(checkout) && (
              <>
                <div className="flex flex-col gap-y-2">
                  <div className="flex flex-row items-center gap-x-3">
                    {hasMedia && checkout.product.medias[0]?.public_url && (
                      <Dialog>
                        <DialogTrigger
                          asChild
                          disabled={checkout.product.medias.length <= 1}
                        >
                          <button
                            className={`relative h-10 w-10 shrink-0 ${checkout.product.medias.length > 1 ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <UploadImage
                              src={checkout.product.medias[0].public_url}
                              approximateWidth={40}
                              alt={checkout.product.name}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                            {checkout.product.medias.length > 1 && (
                              <span className="absolute right-0 bottom-0 rounded bg-black/60 px-1 py-0.5 text-[10px] leading-none font-medium text-white">
                                +{checkout.product.medias.length - 1}
                              </span>
                            )}
                          </button>
                        </DialogTrigger>
                        <DialogContent className="dark:bg-polar-900 max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{checkout.product.name}</DialogTitle>
                            <DialogDescription className="sr-only">
                              Product images
                            </DialogDescription>
                          </DialogHeader>
                          <Slideshow
                            images={checkout.product.medias.map((m) =>
                              getResizedImage(m.public_url, 672),
                            )}
                          />
                        </DialogContent>
                      </Dialog>
                    )}
                    <div className="flex min-w-0 flex-col gap-y-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {checkout.product.name}
                      </span>
                    </div>
                  </div>
                  <span className="text-3xl font-medium">
                    <CheckoutHeroPrice checkout={checkout} locale={locale} />
                  </span>
                </div>
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
                {!checkout.is_free_product_price && (
                  <div className="flex flex-col gap-4 text-sm">
                    {checkout.product_price.amount_type === 'seat_based' && (
                      <CheckoutSeatSelector
                        checkout={checkout}
                        update={update}
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
                      collapsible
                    />
                  </div>
                )}
                {checkout.product.description && (
                  <CheckoutProductDescription
                    description={checkout.product.description}
                    productName={checkout.product.name}
                    locale={locale}
                  />
                )}
              </>
            )}
          </div>
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
