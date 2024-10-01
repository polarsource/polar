'use client'

import { OrganizationIssueSummaryList } from '@/components/Organization/OrganizationIssueSummaryList'
import { ProductCard } from '@/components/Products/ProductCard'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { hasRecurringInterval } from '@/components/Subscriptions/utils'
import { useRecurringInterval } from '@/hooks/products'
import { organizationPageLink } from '@/utils/nav'
import { Article, IssueFunding, Organization, Product } from '@polar-sh/sdk'
import Link from 'next/link'
import { useMemo } from 'react'
import { NewsletterFeed } from './NewsletterFeed'
import { ProductsGrid } from './ProductsGrid'

export const Storefront = ({
  organization,
  posts,
  products,
  issues,
}: {
  organization: Organization
  posts: Article[]
  products: Product[]
  issues: IssueFunding[]
}) => {
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(products)

  const subscriptionProducts = useMemo(
    () => products.filter(hasRecurringInterval(recurringInterval)),
    [products, recurringInterval],
  )

  const oneTimeProducts = useMemo(
    () => products.filter((p) => !p.is_recurring),
    [products],
  )

  return (
    <div className="flex w-full flex-col gap-y-24">
      <div className="flex flex-col gap-24 lg:flex-row lg:gap-16">
        <div className="flex w-full min-w-0 flex-shrink flex-col gap-y-24">
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
                  className="flex-shrink-0 self-stretch"
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

          {organization.feature_settings?.articles_enabled &&
            posts.length > 0 && (
              <NewsletterFeed organization={organization} posts={posts} />
            )}

          {organization.feature_settings?.issue_funding_enabled &&
          issues.length > 0 ? (
            <div className="flex flex-col">
              <OrganizationIssueSummaryList
                issues={issues}
                organization={organization}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
