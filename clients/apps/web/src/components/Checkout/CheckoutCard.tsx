'use client'

import { resolveBenefitIcon } from '@/components/Benefit/utils'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import SubscriptionTierRecurringIntervalSwitch from '@/components/Subscriptions/SubscriptionTierRecurringIntervalSwitch'
import {
  useRecurringInterval,
  useRecurringProductPrice,
} from '@/hooks/products'
import { Organization, Product } from '@polar-sh/sdk'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

export interface CheckoutCardProps {
  organization: Organization
  product: Product
}

export const CheckoutCard = ({ organization, product }: CheckoutCardProps) => {
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval([product])

  const recurringPrice = useRecurringProductPrice(product, recurringInterval)
  const oneTimePrice = product.prices.find((price) => price.type === 'one_time')
  const isFixedPrice = product.prices.every(
    (price) => price.amount_type === 'fixed',
  )

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {hasBothIntervals && (
        <SubscriptionTierRecurringIntervalSwitch
          recurringInterval={recurringInterval}
          onChange={setRecurringInterval}
        />
      )}
      <ShadowBox className="dark:bg-polar-950 flex flex-col gap-8 bg-gray-100 md:ring-gray-100">
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-light">
            {recurringPrice ? (
              <ProductPriceLabel price={recurringPrice} />
            ) : (
              oneTimePrice && <ProductPriceLabel price={oneTimePrice} />
            )}
          </h1>
          {isFixedPrice && (
            <p className="dark:text-polar-500 text-sm text-gray-400">
              Before VAT and taxes
            </p>
          )}
        </div>
        {product.benefits.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="font-medium dark:text-white">Included</h1>
            </div>
            <List size="small">
              {product.benefits.map((benefit) => (
                <ListItem
                  key={benefit.id}
                  className="justify-start gap-x-3"
                  size="small"
                >
                  {resolveBenefitIcon(benefit, 'small', 'h-4 w-4')}
                  <span className="text-sm">{benefit.description}</span>
                </ListItem>
              ))}
            </List>
          </div>
        ) : (
          <></>
        )}
      </ShadowBox>
    </div>
  )
}
