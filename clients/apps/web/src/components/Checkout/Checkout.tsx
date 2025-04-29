'use client'

import { useCheckoutConfirmedRedirect } from '@/hooks/checkout'
import {
  CheckoutForm,
  CheckoutProductSwitcher,
  CheckoutPWYWForm,
} from '@polar-sh/checkout/components'
import { useCheckoutFulfillmentListener } from '@polar-sh/checkout/hooks'
import { useCheckout, useCheckoutForm } from '@polar-sh/checkout/providers'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import { ProductPriceCustom } from '@polar-sh/sdk/models/components/productpricecustom.js'
import ShadowBox, {
  ShadowBoxOnMd,
} from '@polar-sh/ui/components/atoms/ShadowBox'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import { useCallback, useMemo, useState } from 'react'
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
    update,
    confirm: _confirm,
    loading: confirmLoading,
    loadingLabel,
  } = useCheckoutForm()
  const embed = _embed === true
  const { resolvedTheme } = useTheme()
  const theme = _theme || (resolvedTheme as 'light' | 'dark')

  const themePreset = useThemePreset(
    checkout.organization.slug === 'midday' ? 'midday' : 'polar',
    theme,
  )

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
        <CheckoutForm
          form={form}
          checkout={checkout}
          update={update}
          confirm={confirm}
          loading={loading}
          loadingLabel={label}
          theme={theme}
          themePreset={themePreset}
        />
      </div>
    </ShadowBoxOnMd>
  )
}

export default Checkout
