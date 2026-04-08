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
import type { schemas } from '@polar-sh/client'
import type { AcceptedLocale } from '@polar-sh/i18n'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import type { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import type { UseFormReturn } from 'react-hook-form'
import { CheckoutDiscountInput } from './CheckoutDiscountInput'
import { CheckoutPaymentNotReadyBanner } from './CheckoutPaymentNotReadyBanner'

interface CheckoutEmbedViewProps {
  checkout: schemas['CheckoutPublic']
  form: UseFormReturn<schemas['CheckoutUpdatePublic']>
  update: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<schemas['CheckoutPublic']>
  confirm: (
    data: schemas['CheckoutConfirmStripe'],
    stripe: Stripe | null,
    elements: StripeElements | null,
  ) => Promise<schemas['CheckoutPublicConfirmed']>
  loading: boolean
  loadingLabel: string | undefined
  theme: 'light' | 'dark'
  themePreset: ThemingPresetProps
  shouldBlockCheckout: boolean
  organizationStatus: string | undefined
  isUpdatePending: boolean
  locale: AcceptedLocale
}

export const CheckoutEmbedView = ({
  checkout,
  form,
  update,
  confirm,
  loading,
  loadingLabel,
  theme,
  themePreset,
  shouldBlockCheckout,
  organizationStatus,
  isUpdatePending,
  locale,
}: CheckoutEmbedViewProps) => {
  return (
    <ShadowBox className="dark:md:bg-polar-900 flex flex-col gap-y-12 divide-gray-200 overflow-hidden rounded-3xl md:bg-white dark:divide-transparent">
      {shouldBlockCheckout && (
        <CheckoutPaymentNotReadyBanner
          organizationStatus={organizationStatus}
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
        loadingLabel={loadingLabel}
        theme={theme}
        themePreset={themePreset}
        disabled={shouldBlockCheckout}
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
