'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import { OrganizationIssueSummaryList } from '@/components/Organization/OrganizationIssueSummaryList'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierSubscribeButton from '@/components/Subscriptions/SubscriptionTierSubscribeButton'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { ArrowForwardOutlined, BoltOutlined } from '@mui/icons-material'
import {
  ListResourceArticle,
  ListResourceSubscriptionTier,
  Organization,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { useMemo } from 'react'

const ClientPage = ({
  organization,
  pinnedArticles,
  articles,
  subscriptionTiers,
}: {
  organization: Organization
  pinnedArticles: ListResourceArticle
  articles: ListResourceArticle
  subscriptionTiers: ListResourceSubscriptionTier
}) => {
  useTrafficRecordPageView({ organization })

  const orgs = useListAdminOrganizations()

  const shouldRenderSubscribeButton = useMemo(
    () => !orgs.data?.items?.map((o) => o.id).includes(organization.id),
    [organization, orgs],
  )

  const highlightedTiers = useMemo(
    () =>
      subscriptionTiers.items?.filter(
        ({ type, is_highlighted }) => type === 'free' || is_highlighted,
      ) ?? [],
    [subscriptionTiers.items],
  )

  return (
    <div className="flex w-full flex-col gap-y-6">
      <div className="flex w-full flex-col gap-y-16">
        {(pinnedArticles.items?.length ?? 0) > 0 ? (
          <div className="flex flex-col gap-y-8">
            <div className="flex flex-row justify-between">
              <h2 className="text-lg">Pinned Posts</h2>
              <Link
                className="text-sm text-blue-500 dark:text-blue-400"
                href={`/${organization.name}/posts`}
              >
                <span>View all posts</span>
                <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
              </Link>
            </div>
            <div className="flex w-full flex-col gap-y-6">
              {pinnedArticles.items?.map((post) => (
                <PostComponent article={post} key={post.id} highlightPinned />
              ))}
            </div>
          </div>
        ) : null}
        <div className="dark:border-polar-800 flex flex-col items-center gap-y-12 rounded-[3rem] border-gray-100 dark:bg-transparent md:border md:bg-white md:py-12 md:shadow-sm">
          <div className="flex flex-col items-center gap-y-4">
            <BoltOutlined
              className="text-blue-500 dark:text-blue-400"
              fontSize="large"
            />
            <h2 className="text-xl">Subscriptions</h2>
            <p className="dark:text-polar-500 text-center text-gray-500 [text-wrap:balance]">
              Support {organization.name} with a subscription & receive unique
              benefits in return
            </p>
          </div>
          <div className="flex w-fit flex-row flex-wrap gap-6">
            {highlightedTiers.map((tier) => (
              <SubscriptionTierCard
                variant="small"
                className="w-full self-stretch md:w-[250px]"
                key={tier.id}
                subscriptionTier={tier}
              >
                {shouldRenderSubscribeButton &&
                  (tier.type === 'free' ? (
                    <FreeTierSubscribe
                      subscriptionTier={tier}
                      organization={organization}
                    />
                  ) : (
                    <SubscriptionTierSubscribeButton
                      organization={organization}
                      subscriptionTier={tier}
                      subscribePath="/subscribe"
                    />
                  ))}
              </SubscriptionTierCard>
            ))}
          </div>
          <Link href={`/${organization.name}/subscriptions`}>
            <Button variant="ghost">
              <span>View all tiers</span>
              <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
            </Button>
          </Link>
        </div>

        <OrganizationIssueSummaryList organization={organization} />
      </div>
    </div>
  )
}

export default ClientPage
