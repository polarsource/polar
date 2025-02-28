'use client'

import { BenefitList } from '@/components/Products/BenefitList'
import { CheckoutPricing } from '@polar-sh/checkout/components'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'

export interface CheckoutCardProps {
  checkout: CheckoutPublic
  update?: (body: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  disabled?: boolean
}

export const CheckoutCard = ({
  checkout,
  update,
  disabled,
}: CheckoutCardProps) => {
  const { product } = checkout

  return (
    <ShadowBox className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-6 rounded-3xl bg-white shadow-xl">
      <CheckoutPricing
        checkout={checkout}
        update={update}
        disabled={disabled}
      />

      {product.benefits.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-medium dark:text-white">Included</h1>
          </div>
          <div className="flex flex-col gap-y-2">
            {/* @ts-ignore */}
            <BenefitList benefits={product.benefits} toggle={true} />
          </div>
        </div>
      ) : (
        <></>
      )}
    </ShadowBox>
  )
}
