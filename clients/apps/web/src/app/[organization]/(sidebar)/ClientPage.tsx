'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import { OrganizationIssueSummaryList } from '@/components/Organization/OrganizationIssueSummaryList'
import CheckoutButton from '@/components/Products/CheckoutButton'
import { ProductCard } from '@/components/Products/ProductCard'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierRecurringIntervalSwitch from '@/components/Subscriptions/SubscriptionTierRecurringIntervalSwitch'
import { hasRecurringInterval } from '@/components/Subscriptions/utils'
import { useAuth } from '@/hooks'
import { useRecurringInterval } from '@/hooks/products'
import { organizationPageLink } from '@/utils/nav'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { ArrowForward } from '@mui/icons-material'
import {
  Article,
  IssueFunding,
  Organization,
  Product,
  ProductPriceRecurringInterval,
  PublicDonation,
} from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({
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
  useTrafficRecordPageView({ organization })
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(products)

  const { userOrganizations: orgs } = useAuth()

  const shouldRenderSubscribeButton = useMemo(
    () => !orgs.map((o) => o.id).includes(organization.id),
    [organization, orgs],
  )

  const NewsletterBox = () => {
    return (
      organization.feature_settings?.articles_enabled &&
      posts.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-xl">Newsletters</h3>
            <Link
              className="dark:text-polar-500 flex flex-row items-center gap-2 text-sm text-blue-500 transition-colors hover:text-blue-400 dark:hover:text-white"
              href={organizationPageLink(organization, 'posts')}
            >
              <span>View all</span>
              <ArrowForward fontSize="inherit" />
            </Link>
          </div>
          <div className="flex w-full flex-col divide-y">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={organizationPageLink(organization, `posts/${post.slug}`)}
                className="flex w-full flex-col gap-1 py-6 transition-opacity hover:opacity-70"
              >
                <PostComponent article={post} highlightPinned />
              </Link>
            ))}
          </div>
        </div>
      )
    )
  }

  const showFreeTier = organization.profile_settings?.subscribe?.promote ?? true
  const subscriptionProducts = useMemo(
    () =>
      products.filter(hasRecurringInterval(recurringInterval, !showFreeTier)),
    [products, showFreeTier, recurringInterval],
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

          <NewsletterBox />

          {organization.donations_enabled && (
            <DonationsFeed donations={donations} />
          )}

          {organization.feature_settings?.issue_funding_enabled &&
          issues.length > 0 ? (
            <OrganizationIssueSummaryList
              issues={issues}
              organization={organization}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ClientPage

interface ProductsGridProps extends React.PropsWithChildren {
  title: string
  organization: Organization
  recurringInterval?: ProductPriceRecurringInterval
  hasBothIntervals?: boolean
  setRecurringInterval?: (interval: ProductPriceRecurringInterval) => void
}

const ProductsGrid = ({
  title,
  children,
  hasBothIntervals,
  recurringInterval,
  setRecurringInterval,
}: ProductsGridProps) => {
  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-xl">{title}</h2>
      </div>
      {hasBothIntervals && recurringInterval && setRecurringInterval && (
        <div className="flex justify-center">
          <SubscriptionTierRecurringIntervalSwitch
            recurringInterval={recurringInterval}
            onChange={setRecurringInterval}
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  )
}

interface DonationsFeedProps {
  donations: PublicDonation[]
}

const DonationsFeed = ({ donations }: DonationsFeedProps) => {
  const getDonorName = (donation: PublicDonation) => {
    if (donation.donor) {
      return 'public_name' in donation.donor
        ? donation.donor.public_name
        : donation.donor.name
    } else {
      return 'An anonymous donor'
    }
  }

  if (donations.length < 1) {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-y-8 md:gap-y-4">
      <div>
        <h3 className="text-lg">Donations</h3>
      </div>
      <ShadowBoxOnMd className="flex w-full flex-col gap-y-6 md:p-6">
        {donations.map((donation) => (
          <div
            key={donation.id}
            className={twMerge(
              'flex w-full flex-row gap-x-4',
              !donation.message && 'items-center',
            )}
          >
            <Avatar
              className="h-8 w-8"
              avatar_url={donation.donor?.avatar_url ?? null}
              name={getDonorName(donation)}
            />
            <div className="flex w-full flex-col gap-y-2">
              <h3 className="text-sm">
                <span className="font-medium">{getDonorName(donation)}</span>
                {` donated ${formatCurrencyAndAmount(donation.amount, donation.currency)}`}
              </h3>
              {donation.message && (
                <p className="dark:bg-polar-700 rounded-lg bg-gray-100 px-3 py-2 text-sm">
                  {donation.message}
                </p>
              )}
            </div>
          </div>
        ))}
      </ShadowBoxOnMd>
    </div>
  )
}
