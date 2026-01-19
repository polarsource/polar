'use client'

import { BenefitList } from '@/components/Products/BenefitList'
import {
  CheckoutPricing,
  CheckoutSeatSelector,
} from '@polar-sh/checkout/components'
import type { ProductCheckoutPublic } from '@polar-sh/checkout/guards'
import { getTranslations, type SupportedLocale } from '@polar-sh/i18n'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { useMemo } from 'react'
export interface CheckoutCardProps {
  checkout: ProductCheckoutPublic
  update?: (body: CheckoutUpdatePublic) => Promise<ProductCheckoutPublic>
  disabled?: boolean
  isLayoutTreatment?: boolean
  locale?: SupportedLocale
}

export const CheckoutCard = ({
  checkout,
  update,
  disabled,
  isLayoutTreatment = false,
  locale = 'en',
}: CheckoutCardProps) => {
  const t = useMemo(() => getTranslations(locale), [locale])
  const { product, productPrice } = checkout
  const isSeatBased = productPrice && productPrice.amountType === 'seat_based'

  return (
    <ShadowBox className="dark:bg-polar-900 dark:border-polar-700 flex flex-col gap-6 rounded-3xl! border border-gray-200 bg-white shadow-xs">
      {isSeatBased && update ? (
        <CheckoutSeatSelector
          checkout={checkout}
          update={update}
          locale={locale}
        />
      ) : (
        <CheckoutPricing
          checkout={checkout}
          update={update}
          disabled={disabled}
          layout={isLayoutTreatment ? 'stacked' : 'default'}
          locale={locale}
        />
      )}

      {product.benefits.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h1 className="font-medium dark:text-white">{t.form.included}</h1>
          <div className="flex flex-col gap-y-2">
            <BenefitList benefits={product.benefits} toggle={true} />
          </div>
        </div>
      ) : (
        <></>
      )}
    </ShadowBox>
  )
}
