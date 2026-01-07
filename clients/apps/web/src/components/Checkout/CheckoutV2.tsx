'use client'

import { BenefitList } from '@/components/Products/BenefitList'
import { useCheckoutConfirmedRedirect } from '@/hooks/checkout'
import { usePostHog } from '@/hooks/posthog'
import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import {
  CheckoutForm,
  CheckoutProductSwitcher,
  CheckoutPWYWForm,
  CheckoutSeatSelector,
} from '@polar-sh/checkout/components'
import {
  hasLegacyRecurringPrices,
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
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Input from '@polar-sh/ui/components/atoms/Input'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface CheckoutV2Props {
  embed?: boolean
  theme?: 'light' | 'dark'
}

const CheckoutV2 = ({ embed: _embed, theme: _theme }: CheckoutV2Props) => {
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

  const { data: paymentStatus } = useOrganizationPaymentStatus(
    checkout.organization.id,
    true,
    true,
  )

  const isPaymentReady = paymentStatus?.payment_ready ?? true
  const isPaymentRequired = checkout.isPaymentRequired
  const shouldBlockCheckout = !isPaymentReady && isPaymentRequired

  useEffect(() => {
    if (hasTrackedOpen.current) return
    hasTrackedOpen.current = true
    posthog.capture('storefront:subscriptions:checkout:open', {
      organization_slug: checkout.organization.slug,
      product_id: checkout.productId,
      amount: checkout.amount,
      embed,
      variant: 'v2',
    })
  }, [
    checkout.organization.slug,
    checkout.productId,
    checkout.amount,
    embed,
    posthog,
  ])

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
              : `${checkout.organization.name} needs to complete their payment setup before you can make a purchase.`}
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

  const productMedia = hasProductCheckout(checkout)
    ? checkout.product.medias[0]
    : null

  const isSeatBased =
    hasProductCheckout(checkout) &&
    checkout.productPrice?.amountType === 'seat_based'

  const interval = hasProductCheckout(checkout)
    ? hasLegacyRecurringPrices(checkout.prices[checkout.product.id])
      ? checkout.productPrice.recurringInterval
      : checkout.product.recurringInterval
    : null

  const intervalCount = hasProductCheckout(checkout)
    ? checkout.product.recurringIntervalCount
    : null

  const formatInterval = (interval: string | null, count: number | null) => {
    if (!interval) return ''
    const countStr = count && count > 1 ? `${count} ` : ''
    const intervalStr = count && count > 1 ? `${interval}s` : interval
    return ` / ${countStr}${intervalStr}`
  }

  // Discount code state and handlers
  const [discountCodeInput, setDiscountCodeInput] = useState('')
  const [discountCodeLoading, setDiscountCodeLoading] = useState(false)
  const [discountCodeError, setDiscountCodeError] = useState<string | null>(null)
  const hasDiscount = !!checkout.discount

  const applyDiscountCode = useCallback(async () => {
    if (!discountCodeInput.trim()) return
    setDiscountCodeLoading(true)
    setDiscountCodeError(null)
    try {
      await update({ discountCode: discountCodeInput.trim() })
      setDiscountCodeInput('')
    } catch (e) {
      setDiscountCodeError('Invalid discount code')
    } finally {
      setDiscountCodeLoading(false)
    }
  }, [discountCodeInput, update])

  const removeDiscountCode = useCallback(async () => {
    setDiscountCodeLoading(true)
    setDiscountCodeError(null)
    try {
      await update({ discountCode: null })
    } finally {
      setDiscountCodeLoading(false)
    }
  }, [update])

  // Cart summary component for the right sidebar
  const CartSummary = () => (
    <div className="flex flex-col gap-y-6">
      {/* Product info */}
      <div className="flex gap-x-4">
        {productMedia ? (
          <div
            className="h-16 w-16 flex-shrink-0 rounded-lg bg-cover bg-center"
            style={{ backgroundImage: `url(${productMedia.publicUrl})` }}
          />
        ) : (
          <div className="dark:bg-polar-800 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
            <Avatar
              className="h-10 w-10"
              avatar_url={checkout.organization.avatarUrl}
              name={checkout.organization.name}
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-y-1">
          <span className="text-sm font-medium leading-tight">
            {checkout.product?.name}
          </span>
          {hasProductCheckout(checkout) && checkout.product.description && (
            <span className="dark:text-polar-500 line-clamp-2 text-xs text-gray-500">
              {checkout.product.description.replace(/[#*_`]/g, '').slice(0, 100)}
            </span>
          )}
        </div>
      </div>

      {/* Quantity / Seats selector */}
      {hasProductCheckout(checkout) && isSeatBased && update && (
        <CheckoutSeatSelector
          checkout={checkout as ProductCheckoutPublic}
          update={update as (data: CheckoutUpdatePublic) => Promise<ProductCheckoutPublic>}
        />
      )}

      {/* Discount code */}
      {checkout.allowDiscountCodes && checkout.isDiscountApplicable && (
        <div className="dark:border-polar-700 flex flex-col gap-y-2 border-t border-gray-200 pt-4">
          <label className="text-sm font-medium">Discount code</label>
          <div className="relative">
            <Input
              type="text"
              placeholder="Enter code"
              value={hasDiscount ? checkout.discount?.code || '' : discountCodeInput}
              onChange={(e) => setDiscountCodeInput(e.target.value)}
              disabled={hasDiscount || discountCodeLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyDiscountCode()
                }
              }}
              className="pr-16"
            />
            <div className="absolute inset-y-0 right-1 z-10 flex items-center">
              {!hasDiscount && discountCodeInput && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={applyDiscountCode}
                  loading={discountCodeLoading}
                >
                  Apply
                </Button>
              )}
              {hasDiscount && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={removeDiscountCode}
                  loading={discountCodeLoading}
                >
                  <span className="text-lg leading-none">&times;</span>
                </Button>
              )}
            </div>
          </div>
          {discountCodeError && (
            <span className="text-sm text-red-500">{discountCodeError}</span>
          )}
        </div>
      )}

      {/* Cost summary */}
      <div className="dark:border-polar-700 flex flex-col gap-y-3 border-t border-gray-200 pt-4">
        <div className="flex justify-between text-sm">
          <span className="dark:text-polar-400 text-gray-600">Subtotal</span>
          <span>
            {formatCurrencyAndAmount(checkout.amount, checkout.currency)}
            {formatInterval(interval, intervalCount)}
          </span>
        </div>

        {checkout.discount && (
          <div className="flex justify-between text-sm text-green-600 dark:text-green-500">
            <span>{checkout.discount.name}</span>
            <span>
              -{formatCurrencyAndAmount(checkout.discountAmount, checkout.currency)}
            </span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="dark:text-polar-400 text-gray-600">Tax</span>
          <span>
            {checkout.taxAmount !== null
              ? formatCurrencyAndAmount(checkout.taxAmount, checkout.currency)
              : '—'}
          </span>
        </div>

        <div className="dark:border-polar-700 flex justify-between border-t border-gray-200 pt-3 font-medium">
          <span>{interval ? `Every ${intervalCount && intervalCount > 1 ? `${intervalCount} ${interval}s` : interval}` : 'Total'}</span>
          <span>
            {formatCurrencyAndAmount(checkout.totalAmount, checkout.currency)}
            {formatInterval(interval, intervalCount)}
          </span>
        </div>

        {checkout.taxAmount !== null && checkout.taxAmount > 0 && (
          <span className="dark:text-polar-500 text-xs text-gray-500">
            Including {formatCurrencyAndAmount(checkout.taxAmount, checkout.currency)} in taxes
          </span>
        )}

        {/* Trial info */}
        {(checkout.trialEnd ||
          (checkout.activeTrialInterval && checkout.activeTrialIntervalCount)) && (
          <div className="dark:border-polar-700 mt-2 flex flex-col gap-y-2 border-t border-gray-200 pt-3">
            {checkout.activeTrialInterval && checkout.activeTrialIntervalCount && (
              <div className="flex justify-between text-sm font-medium">
                <span>
                  {checkout.activeTrialIntervalCount} {checkout.activeTrialInterval}
                  {checkout.activeTrialIntervalCount > 1 ? 's' : ''} trial
                </span>
                <span>Free</span>
              </div>
            )}
            {checkout.trialEnd && (
              <span className="dark:text-polar-500 text-xs text-gray-500">
                Trial ends <FormattedDateTime datetime={checkout.trialEnd} resolution="day" />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Benefits */}
      {hasProductCheckout(checkout) && checkout.product.benefits.length > 0 && (
        <div className="dark:border-polar-700 flex flex-col gap-y-3 border-t border-gray-200 pt-4">
          <span className="text-sm font-medium">What&apos;s included</span>
          <BenefitList benefits={checkout.product.benefits} toggle={true} />
        </div>
      )}
    </div>
  )

  if (embed) {
    return (
      <div className="dark:bg-polar-900 flex flex-col gap-y-8 rounded-3xl bg-white p-6">
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
      </div>
    )
  }

  return (
    <ShadowBoxOnMd className="md:dark:border-polar-700 dark:md:bg-polar-900 mx-auto flex w-full max-w-4xl flex-col gap-y-12 divide-gray-200 rounded-3xl md:flex-row md:items-stretch md:gap-y-0 md:divide-x md:overflow-hidden md:border md:border-gray-100 md:bg-white md:p-0 md:shadow-xs dark:divide-transparent">
      {/* Left column - Form */}
      <div className="flex flex-1 flex-col gap-y-8 md:p-12">
        {/* Store name */}
        <div className="flex items-center gap-x-3">
          <Avatar
            className="h-8 w-8"
            avatar_url={checkout.organization.avatarUrl}
            name={checkout.organization.name}
          />
          <span className="font-medium">{checkout.organization.name}</span>
        </div>

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
          hidePricingSummary
          hideDiscountCode
        />
      </div>

      {/* Right column - Cart summary */}
      <div className="md:dark:bg-polar-950 flex w-full flex-col gap-y-8 md:w-96 md:flex-shrink-0 md:bg-gray-50 md:p-6">
        <CartSummary />
      </div>
    </ShadowBoxOnMd>
  )
}

export default CheckoutV2
