'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import { OrganizationIssueSummaryList } from '@/components/Organization/OrganizationIssueSummaryList'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierSubscribeButton from '@/components/Subscriptions/SubscriptionTierSubscribeButton'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { StarIcon } from '@heroicons/react/20/solid'
import {
  ArrowForwardOutlined,
  BoltOutlined,
  HiveOutlined,
} from '@mui/icons-material'
import {
  Article,
  ListResourceSubscriptionTier,
  Organization,
  Repository,
  Visibility,
} from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Pill,
} from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { useMemo } from 'react'

const ClientPage = ({
  organization,
  posts,
  subscriptionTiers,
  repositories,
}: {
  organization: Organization
  posts: Article[]
  subscriptionTiers: ListResourceSubscriptionTier
  repositories: Repository[]
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
      <div className="flex w-full flex-col gap-y-12">
        {(posts.length ?? 0) > 0 ? (
          <div className="flex flex-col gap-y-8">
            <div className="flex flex-row justify-between">
              <h2 className="text-lg">Pinned & Latest Posts</h2>
              <Link
                className="text-sm text-blue-500 dark:text-blue-400"
                href={`/${organization.name}/posts`}
              >
                <span>View all posts</span>
                <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
              </Link>
            </div>
            <div className="flex w-full flex-col gap-y-6">
              {posts.map((post) => (
                <PostComponent article={post} key={post.id} highlightPinned />
              ))}
            </div>
          </div>
        ) : null}
        {highlightedTiers.length > 1 && (
          <div className="flex flex-col items-center gap-y-12 md:py-12">
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
            <div className="flex w-fit flex-row flex-wrap gap-8">
              {highlightedTiers.map((tier) => (
                <SubscriptionTierCard
                  variant="small"
                  className="w-full self-stretch md:w-[276px]"
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
            <Link
              className="text-sm text-blue-500 dark:text-blue-400"
              href={`/${organization.name}/subscriptions`}
            >
              <span>View all tiers</span>
              <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
            </Link>
          </div>
        )}

        {repositories.length > 0 && (
          <div className="flex flex-col gap-y-8">
            <div className="flex flex-row items-center justify-between">
              <h3 className="text-lg">Popular Repositories</h3>
              <Link
                className="text-sm text-blue-500 dark:text-blue-400"
                href={`/${organization.name}/repositories`}
              >
                <span>View all repositories</span>
                <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {repositories.map((repository) => (
                <Link
                  href={`/${organization.name}/${repository.name}`}
                  key={repository.id}
                >
                  <Card className="dark:hover:bg-polar-800 dark:text-polar-500 dark:hover:text-polar-300 transition-color flex h-full flex-col rounded-3xl text-gray-500 duration-100 hover:bg-gray-50 hover:text-gray-600">
                    <CardHeader className="flex flex-row justify-between p-6">
                      <div className="flex flex-row items-baseline gap-x-3">
                        <span className="text-[20px] text-blue-500">
                          <HiveOutlined fontSize="inherit" />
                        </span>
                        <h3 className="dark:text-polar-50 text-lg text-gray-950">
                          {repository.name}
                        </h3>
                      </div>
                    </CardHeader>
                    {repository.description && (
                      <CardContent className="flex grow flex-col flex-wrap px-6 py-0 ">
                        <p>{repository.description}</p>
                      </CardContent>
                    )}
                    <CardFooter className="flex flex-row items-center gap-x-4 p-6">
                      {repository.license ? (
                        <Pill className="px-3" color="blue">
                          {repository.license}
                        </Pill>
                      ) : (
                        <Pill className="grow-0 px-3" color="gray">
                          Unlicensed
                        </Pill>
                      )}
                      {repository.visibility === Visibility.PRIVATE ? (
                        <Pill className="grow-0 px-3" color="gray">
                          Private
                        </Pill>
                      ) : null}
                      <span className="flex flex-row items-center gap-x-1 text-sm">
                        <StarIcon className="h-4 w-4" />
                        <span className="pt-.5">{repository.stars}</span>
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        <OrganizationIssueSummaryList organization={organization} />
      </div>
    </div>
  )
}

export default ClientPage
