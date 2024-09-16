'use client'

import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import { OrganizationIssueSummaryList } from '@/components/Organization/OrganizationIssueSummaryList'
import CheckoutButton from '@/components/Products/CheckoutButton'
import { ProductCard } from '@/components/Products/ProductCard'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { hasRecurringInterval } from '@/components/Subscriptions/utils'
import { useAuth } from '@/hooks'
import { useRecurringInterval } from '@/hooks/products'
import { organizationPageLink } from '@/utils/nav'
import {
  Article,
  IssueFunding,
  Organization,
  Product,
  PublicDonation,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { useMemo } from 'react'
import { DonationsFeed } from './DonationsFeed'
import { NewsletterFeed } from './NewsletterFeed'
import { ProductsGrid } from './ProductsGrid'

export const PublicPage = ({
  organization,
  posts,
  products,
  issues,
  donations,
}: {
  organization: Organization
  posts: Article[]
  products: Product[]
  issues: IssueFunding[]
  donations: PublicDonation[]
}) => {
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(products)

  const { userOrganizations: orgs } = useAuth()

  const shouldRenderSubscribeButton = useMemo(
    () => !orgs.map((o) => o.id).includes(organization.id),
    [organization, orgs],
  )

  const subscriptionProducts = useMemo(
    () => products.filter(hasRecurringInterval(recurringInterval, true)),
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
              recurringInterval={recurringInterval}
              hasBothIntervals={hasBothIntervals}
              setRecurringInterval={setRecurringInterval}
            >
              {subscriptionProducts.map((tier) => (
                <SubscriptionTierCard
                  className="w-full self-stretch"
                  key={tier.id}
                  subscriptionTier={tier}
                  recurringInterval={recurringInterval}
                >
                  {shouldRenderSubscribeButton &&
                    (tier.type === 'free' ? (
                      <FreeTierSubscribe
                        product={tier}
                        organization={organization}
                      />
                    ) : (
                      <CheckoutButton
                        organization={organization}
                        recurringInterval={recurringInterval}
                        product={tier}
                        checkoutPath="/api/checkout"
                      >
                        Subscribe
                      </CheckoutButton>
                    ))}
                </SubscriptionTierCard>
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

          {organization.donations_enabled && (
            <DonationsFeed donations={donations} />
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
