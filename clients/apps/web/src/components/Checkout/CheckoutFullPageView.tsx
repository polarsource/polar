'use client'

import { UploadImage } from '@/components/Image/Image'
import { getResizedImage } from '@/utils/getResizedImage'
import { hasMarkdown, markdownOptions } from '@/utils/markdown'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
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
import { type AcceptedLocale, useTranslations } from '@polar-sh/i18n'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@polar-sh/ui/components/ui/dialog'
import type { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import type { UseFormReturn } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { Slideshow } from '../Products/Slideshow'
import { CheckoutDiscountInput } from './CheckoutDiscountInput'
import { CheckoutPaymentNotReadyBanner } from './CheckoutPaymentNotReadyBanner'
import { CheckoutTruncatedDescription } from './CheckoutTruncatedDescription'

interface CheckoutFullPageViewProps {
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

export const CheckoutFullPageView = ({
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
}: CheckoutFullPageViewProps) => {
  const t = useTranslations(locale)

  const hasMedia =
    hasProductCheckout(checkout) && checkout.product.medias.length > 0

  const orgHeader = (
    <div className="flex flex-row items-center gap-x-4">
      {checkout.return_url && (
        <Link
          href={checkout.return_url}
          className="dark:text-polar-500 text-gray-600"
        >
          <ArrowBackOutlined fontSize="small" />
        </Link>
      )}
      <div className="flex flex-row items-center gap-x-2">
        <Avatar
          avatar_url={checkout.organization.avatar_url}
          name={checkout.organization.name}
          className="h-6 w-6"
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
                  <div
                    className={twMerge(
                      'flex flex-row gap-x-3',
                      checkout.product.description
                        ? 'items-start'
                        : 'items-center',
                    )}
                  >
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
                      {checkout.product.description &&
                        !hasMarkdown(checkout.product.description) && (
                          <CheckoutTruncatedDescription
                            description={checkout.product.description}
                            productName={checkout.product.name}
                            readMoreLabel={t(
                              'checkout.productDescription.readMore',
                            )}
                          />
                        )}
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
                {checkout.product.description &&
                  hasMarkdown(checkout.product.description) && (
                    <div
                      id="description"
                      className="prose dark:prose-invert prose-headings:mt-4 prose-headings:font-medium prose-headings:text-black prose-h1:text-xl prose-h2:text-lg prose-h3:text-md dark:prose-headings:text-white dark:text-polar-300 leading-normal text-gray-800"
                    >
                      <Markdown options={markdownOptions}>
                        {checkout.product.description}
                      </Markdown>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="dark:md:bg-polar-900 md:bg-white">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-y-8 px-4 py-6 md:mx-0 md:py-12 md:pr-4 md:pl-12">
          {shouldBlockCheckout && (
            <CheckoutPaymentNotReadyBanner
              organizationStatus={organizationStatus}
              organizationName={checkout.organization.name}
            />
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
          />
        </div>
      </div>
    </div>
  )
}
