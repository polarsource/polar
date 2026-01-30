'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { useRecurringInterval } from '@/hooks/products'
import { organizationPageLink } from '@/utils/nav'
import { isLegacyRecurringPrice } from '@/utils/product'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { useMemo } from 'react'
import { ProductsGrid } from './ProductsGrid'

export const Storefront = ({
  organization,
  products,
}: {
  organization: schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
}) => {
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(products)

  const subscriptionProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.is_recurring &&
          (p.recurring_interval === recurringInterval ||
            p.prices.some(
              (price) =>
                isLegacyRecurringPrice(price) &&
                price.recurring_interval === recurringInterval,
            )),
      ),
    [products, recurringInterval],
  )

  const oneTimeProducts = useMemo(
    () => products.filter((p) => !p.is_recurring),
    [products],
  )

  return (
    <div className="flex w-full flex-col gap-y-24">
      <div className="flex flex-col gap-24 lg:flex-row lg:gap-16">
        <div className="flex w-full min-w-0 shrink flex-col gap-y-24">
          {subscriptionProducts.length < 1 && oneTimeProducts.length < 1 ? (
            <ShadowBoxOnMd className="items-center justify-center gap-y-6 md:flex md:flex-col md:py-48">
              <HiveOutlined
                className="dark:text-polar-600 text-5xl text-gray-300"
                fontSize="large"
              />
              <div className="flex flex-col items-center gap-y-6">
                <div className="flex flex-col items-center gap-y-2">
                  <h3 className="text-lg font-medium">No products found</h3>
                  <p className="dark:text-polar-500 text-gray-500">
                    {organization.name} is not offering any products yet
                  </p>
                </div>
              </div>
            </ShadowBoxOnMd>
          ) : null}

          {subscriptionProducts.length > 0 && (
            <ProductsGrid
              title="Subscriptions"
              organization={organization}
              hasBothIntervals={hasBothIntervals}
              recurringInterval={recurringInterval}
              setRecurringInterval={setRecurringInterval}
            >
              {subscriptionProducts.map((tier) => (
                <Link
                  className="shrink-0 self-stretch"
                  key={tier.id}
                  href={`/${organization.slug}/products/${tier.id}`}
                >
                  <SubscriptionTierCard
                    className="h-full"
                    subscriptionTier={tier}
                    recurringInterval={recurringInterval}
                  />
                </Link>
              ))}
            </ProductsGrid>
          )}

          {oneTimeProducts.length > 0 && (
            <ProductsGrid title="Products" organization={organization}>
              {oneTimeProducts.map((product) => (
                <Link
                  key={product.id}
                  href={organizationPageLink(
                    organization,
                    `products/${product.id}`,
                  )}
                >
                  <ProductCard key={product.id} product={product} />
                </Link>
              ))}
            </ProductsGrid>
          )}
        </div>
      </div>
    </div>
  )
}
