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
  ProductPriceLabel,
} from '@polar-sh/checkout/components'
import {
  hasProductCheckout,
  type ProductCheckoutPublic,
} from '@polar-sh/checkout/guards'
import { useCheckoutFulfillmentListener } from '@polar-sh/checkout/hooks'
import { useCheckout, useCheckoutForm } from '@polar-sh/checkout/providers'
import { formatCurrency } from '@polar-sh/currency'
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

  const { variant: flattenExperiment } = useExperiment('checkout_flatten')

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
    const isFlat = flattenExperiment === 'treatment'
    const EmbedWrapper = isFlat ? 'div' : ShadowBox
    return (
      <EmbedWrapper className="dark:md:bg-polar-900 flex flex-col gap-y-12 divide-gray-200 overflow-hidden rounded-3xl md:bg-white dark:divide-transparent">
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
          flattenExperiment={flattenExperiment}
          beforeSubmit={
            hasProductCheckout(checkout) && !checkout.isFreeProductPrice ? (
              <div className="flex flex-col gap-4">
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
      </EmbedWrapper>
    )
  }

  const isFlat = flattenExperiment === 'treatment'
  const hasMedia =
    hasProductCheckout(checkout) && checkout.product.medias.length > 0

  const orgHeader = (
    <div className="flex flex-row items-center gap-x-4">
      {checkout.returnUrl && (
        <Link
          href={checkout.returnUrl}
          className={`dark:text-polar-500 ${isFlat ? 'text-gray-600' : 'text-gray-500'}`}
        >
          <ArrowBackOutlined fontSize="small" />
        </Link>
      )}
      <div className="flex flex-row items-center gap-x-2">
        <Avatar
          avatar_url={checkout.organization.avatarUrl}
          name={checkout.organization.name}
          className={isFlat ? 'h-6 w-6' : 'h-8 w-8'}
        />
        <span
          className={
            isFlat ? 'text-sm dark:text-white' : 'font-medium dark:text-white'
          }
        >
          {checkout.organization.name}
        </span>
      </div>
    </div>
  )

  if (isFlat) {
    return (
      <div className="md:grid md:min-h-screen md:grid-cols-2">
        <div className="md:flex md:justify-end">
          <div className="flex w-full max-w-[480px] flex-col gap-y-8 px-4 py-6 md:py-12 md:pr-12 md:pl-4">
            {orgHeader}
            <div className="flex flex-col gap-y-8 md:sticky md:top-8">
              {hasProductCheckout(checkout) && (
                <>
                  <div className="flex flex-col gap-y-2">
                    <div className="flex flex-row items-start gap-x-3">
                      {hasMedia && checkout.product.medias[0]?.publicUrl && (
                        <img
                          src={checkout.product.medias[0].publicUrl}
                          alt={checkout.product.name}
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span className="dark:text-polar-400 text-sm text-gray-600">
                          {checkout.product.name}
                        </span>
                        {checkout.product.description && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="dark:text-polar-400 dark:hover:text-polar-300 line-clamp-1 cursor-pointer text-left text-xs text-gray-600 hover:text-gray-700">
                                {checkout.product.description}
                              </button>
                            </DialogTrigger>
                            <DialogContent className="dark:bg-polar-900 max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  {checkout.product.name}
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                  Product description
                                </DialogDescription>
                              </DialogHeader>
                              <div className="prose dark:prose-invert prose-headings:mt-4 prose-headings:font-medium prose-headings:text-black prose-h1:text-xl prose-h2:text-lg prose-h3:text-md dark:prose-headings:text-white dark:text-polar-300 leading-normal whitespace-pre-line text-gray-800">
                                {checkout.product.description}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                    <span className="text-3xl font-medium">
                      {checkout.productPrice.amountType === 'seat_based' ? (
                        formatCurrency('compact', locale)(
                          checkout.netAmount || 0,
                          checkout.productPrice.priceCurrency,
                        )
                      ) : (
                        <ProductPriceLabel
                          product={checkout.product}
                          price={checkout.productPrice}
                          locale={locale}
                        />
                      )}
                    </span>
                  </div>
                  <CheckoutProductSwitcher
                    checkout={checkout}
                    update={
                      update as (
                        data: CheckoutUpdatePublic,
                      ) => Promise<ProductCheckoutPublic>
                    }
                    themePreset={themePreset}
                    locale={locale}
                    flattenExperiment={flattenExperiment}
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
                    <div className="flex flex-col gap-4 text-sm">
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
                        flattenExperiment={flattenExperiment}
                      />
                      <CheckoutDiscountInput
                        checkout={checkout}
                        update={update}
                        locale={locale}
                        collapsible
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="dark:md:bg-polar-900 md:bg-white">
          <div className="flex w-full max-w-[480px] flex-col gap-y-8 px-4 py-6 md:py-12 md:pr-4 md:pl-12">
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
              flattenExperiment={flattenExperiment}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-y-6">
      {orgHeader}
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
          />
        </div>
      </ShadowBoxOnMd>
    </div>
  )
}

export default Checkout
