'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { Modal, ModalHeader } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { resolveBenefitIcon } from '@/components/Subscriptions/utils'
import { useAuth } from '@/hooks'
import { RssIcon } from '@heroicons/react/24/outline'
import { ViewDayOutlined } from '@mui/icons-material'
import {
  Article,
  CreatePersonalAccessTokenResponse,
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { api } from 'polarkit/api'
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CopyToClipboardInput,
} from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'
import {
  useSearchArticles,
  useSubscriptionSummary,
  useSubscriptionTiers,
} from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import React, { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const {
    isShown: rssModalIsShown,
    hide: hideRssModal,
    show: showRssModal,
  } = useModal()

  const posts = useSearchArticles(organization.name)
  const infinitePosts =
    posts.data?.pages
      .flatMap((page) => page.items)
      .filter((item): item is Article => Boolean(item)) ?? []

  const [ref, inView] = useInView()

  useEffect(() => {
    if (inView && posts.hasNextPage) {
      posts.fetchNextPage()
    }
  }, [inView, posts])

  const { data: subscriptionTiers } = useSubscriptionTiers(organization.name)
  const highlightedTiers = useMemo(
    () => subscriptionTiers?.items?.filter((tier) => tier.is_highlighted),
    [subscriptionTiers],
  )
  const {
    data: {
      items: subscriptionSummary,
      pagination: { total_count: subscribersCount },
    } = {
      items: [],
      pagination: { total_count: 0 },
    },
  } = useSubscriptionSummary(organization.name)

  const getSubscriptionTierAudience = (tier: SubscriptionTier) => {
    switch (tier.type) {
      case SubscriptionTierType.INDIVIDUAL:
        return 'For Individuals'
      case SubscriptionTierType.BUSINESS:
        return 'For Businesses'
    }
  }

  const subscribers = useMemo(
    () => subscriptionSummary?.slice(0, 11) ?? [],
    [subscriptionSummary],
  )

  const subscribersHiddenCount = useMemo(
    () => subscribersCount - (subscribers.length ?? 0),
    [subscribers, subscribersCount],
  )

  return (
    <div className="flex flex-col-reverse gap-x-16 md:flex-row">
      <div className="flex w-full flex-grow flex-col gap-y-6 md:max-w-xl">
        <h2 className="text-lg">Posts</h2>
        <div className="flex w-full flex-col gap-y-6">
          <div className="flex w-full flex-col gap-y-6">
            {infinitePosts.length > 0 ? (
              <>
                {infinitePosts.map((post) => (
                  <PostComponent article={post} key={post.id} />
                ))}
                <div ref={ref} />
              </>
            ) : (
              <>
                {posts.isFetched && infinitePosts.length === 0 ? (
                  <div className="dark:text-polar-400 flex h-full flex-col items-center gap-y-4 pt-32 text-gray-600">
                    <ViewDayOutlined fontSize="large" />
                    <div className="flex flex-col items-center gap-y-2">
                      <h3 className="p-2 text-lg font-medium">No Posts yet</h3>
                      <p className="dark:text-polar-500 min-w-0 truncate text-gray-500">
                        {organization.name} has not posted anything yet
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-shrink flex-col gap-y-10 self-start md:max-w-[300px]">
        {subscribers.length > 0 && (
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-row items-start justify-between">
              <h3 className="dark:text-polar-50 text-gray-950">Subscribers</h3>
              <h3 className="dark:text-polar-500 text-sm text-gray-500">
                {subscribersCount}
              </h3>
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              {subscribers.map(({ user, organization }, idx) => (
                <React.Fragment key={idx}>
                  {organization && (
                    <Link
                      key={organization.name}
                      href={`https://github.com/${organization.name}`}
                      target="_blank"
                    >
                      <Avatar
                        className="h-10 w-10"
                        name={organization.name}
                        avatar_url={organization.avatar_url}
                      />
                    </Link>
                  )}
                  {!organization && (
                    <>
                      {user.github_username ? (
                        <Link
                          key={user.github_username}
                          href={`https://github.com/${user.github_username}`}
                          target="_blank"
                        >
                          <Avatar
                            className="h-10 w-10"
                            name={user.github_username}
                            avatar_url={user.avatar_url}
                          />
                        </Link>
                      ) : (
                        <Avatar
                          className="h-10 w-10"
                          name={user.name}
                          avatar_url={user.avatar_url}
                        />
                      )}
                    </>
                  )}
                </React.Fragment>
              ))}
              {subscribersHiddenCount > 0 && (
                <div className="dark:border-polar-700 dark:bg-polar-900 dark:text-polar-400 flex h-10 w-10 flex-col items-center justify-center rounded-full bg-blue-50 text-xs font-medium text-blue-400 dark:border-2">
                  +{subscribersHiddenCount}
                </div>
              )}
            </div>
          </div>
        )}
        {(highlightedTiers?.length ?? 0) > 0 && (
          <div className="flex w-full flex-col justify-start gap-y-6">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-row items-center justify-between">
                <h3>Subscriptions</h3>
                <Link
                  className="flex flex-row items-center gap-x-2 text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                  href={`/${organization.name}/subscriptions`}
                >
                  <span className="text-xs">View All</span>
                </Link>
              </div>
              <p className="dark:text-polar-500 text-sm leading-normal text-gray-500">
                Support {organization.name} with a paid subsciption & receive
                unique benefits as a bonus
              </p>
            </div>
            <div className="-mx-4 flex flex-row items-start gap-6 overflow-x-auto px-4 pb-6 md:-mx-0 md:flex-col md:px-0 md:pb-0">
              {highlightedTiers?.map((tier) => (
                <Link
                  key={tier.id}
                  className="flex h-full w-4/5 flex-shrink-0 flex-row items-center gap-x-2 md:w-full"
                  href={`/${organization.name}/subscriptions#${tier.name}`}
                >
                  <Card className="dark:hover:bg-polar-800 h-full w-full overflow-hidden transition-colors hover:bg-blue-50">
                    <CardHeader className="flex flex-col gap-y-2 p-6 pb-0">
                      <span className="dark:text-polar-500 text-xs text-gray-500">
                        {getSubscriptionTierAudience(tier)}
                      </span>
                      <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-row gap-x-2">
                          <SubscriptionGroupIcon
                            className="text-[20px]"
                            type={tier.type}
                          />
                          <h3 className="font-medium">{tier.name}</h3>
                        </div>
                        <div>
                          $
                          {getCentsInDollarString(
                            tier.price_amount,
                            false,
                            true,
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-y-4 px-6 py-4">
                      <p className="dark:text-polar-400 text-sm leading-normal text-gray-600">
                        {tier.description}
                      </p>
                    </CardContent>
                    <Separator />
                    <CardFooter className="flex flex-col items-start gap-y-2 p-6">
                      {tier.benefits?.map((benefit) => (
                        <div
                          key={benefit.id}
                          className="dark:text-polar-200 flex flex-row items-start text-gray-950"
                        >
                          <div className="flex flex-row items-center gap-x-2 text-blue-500 dark:text-blue-400">
                            <span className="flex h-6 w-6 flex-row items-center justify-center rounded-full bg-blue-50 text-[14px] dark:bg-blue-950">
                              {resolveBenefitIcon(benefit, 'inherit')}
                            </span>
                            <span className="text-xs">
                              {benefit.description}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col justify-start gap-y-6">
          <div className="hidden flex-col gap-y-2 md:flex">
            <h3>RSS Feed</h3>
            <p className="dark:text-polar-500 text-sm leading-normal text-gray-500">
              Consume posts from {organization.name} in your favorite RSS reader
            </p>
            <Button
              className="flex flex-row self-start p-0 text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={showRssModal}
              variant="ghost"
            >
              <RssIcon className="h-4 w-4" />
              <span className="ml-2 text-sm">Generate RSS Link</span>
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isShown={rssModalIsShown}
        hide={hideRssModal}
        modalContent={
          <RssModal hide={hideRssModal} organization={organization} />
        }
      />
    </div>
  )
}

export default ClientPage

const RssModal = ({
  hide,
  organization,
}: {
  hide: () => void
  organization: Organization
}) => {
  const { currentUser } = useAuth()
  const [token, setToken] = useState<string>()
  const auth = token ? `?auth=${token}` : ''
  const url = `https://polar.sh/${organization.name}/rss${auth}`

  useEffect(() => {
    if (!currentUser) {
      return
    }

    let active = true

    api.personalAccessToken
      .create({
        createPersonalAccessToken: {
          comment: `RSS for ${organization.name}`,
          scopes: ['articles:read'],
        },
      })
      .then((res: CreatePersonalAccessTokenResponse) => {
        if (active) {
          setToken(res.token)
        }
      })

    return () => {
      active = false
    }
  }, [currentUser])

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={hide}>
        <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
          Subscribe to {organization.pretty_name || organization.name} via RSS
        </h3>
      </ModalHeader>
      <div className="p-8">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <span className="font-medium">
              {currentUser ? 'Your feed URL' : 'Feed URL'}
            </span>
            {currentUser ? (
              <p className="text-polar-500 dark:text-polar-500 text-sm">
                This URL is personal, keep it safe.
              </p>
            ) : null}
          </div>

          {url ? (
            <div className="flex items-center gap-2">
              <CopyToClipboardInput value={url} id={'rssurl'} />
              <Link href={`feed:${url}`}>
                <Button asChild>Open</Button>
              </Link>
            </div>
          ) : (
            <Spinner />
          )}
        </div>
      </div>
    </>
  )
}
