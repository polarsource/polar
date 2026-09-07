'use client'

import { UploadImage } from '@/components/Image/Image'
import { getResizedImage } from '@/utils/getResizedImage'
import {
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
  type ProductCheckoutPublic,
} from '@polar-sh/checkout/guards'
import type { schemas } from '@polar-sh/client'
import type { AcceptedLocale } from '@polar-sh/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@polar-sh/ui/components/ui/dialog'
import type { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { Slideshow } from '../Products/Slideshow'
import { CheckoutDiscountInput } from './CheckoutDiscountInput'
import { CheckoutProductDescription } from './CheckoutProductDescription'

export interface CheckoutOrderSummaryProps {
  checkout: ProductCheckoutPublic
  update: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<schemas['CheckoutPublic']>
  themePreset: ThemingPresetProps
  locale: AcceptedLocale
  trialDueTodayExperiment: boolean
}

export const CheckoutOrderSummary = ({
  checkout,
  update,
  themePreset,
  locale,
  trialDueTodayExperiment,
}: CheckoutOrderSummaryProps) => {
  const hasMedia = checkout.product.medias.length > 0

  return (
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
          productPrice={checkout.product_price as schemas['ProductPriceCustom']}
          locale={locale}
        />
      )}
      {!checkout.is_free_product_price && (
        <div className="flex flex-col gap-4 text-sm">
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
          <CheckoutPricingBreakdown
            checkout={checkout}
            locale={locale}
            trialDueTodayExperiment={trialDueTodayExperiment}
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
  )
}
