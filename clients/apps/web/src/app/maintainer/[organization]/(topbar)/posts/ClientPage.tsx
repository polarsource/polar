'use client'

import { AbbreviatedBrowserRender } from '@/components/Feed/Markdown/BrowserRender'
import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { SubscriptionsChart } from '@/components/Subscriptions/SubscriptionsChart'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { firstImageUrlFromMarkdown } from '@/utils/markdown'
import { captureEvent } from '@/utils/posthog'
import { EnvelopeIcon, EyeIcon, PhotoIcon } from '@heroicons/react/24/outline'
import {
  AddOutlined,
  ArrowForward,
  LanguageOutlined,
  ViewDayOutlined,
} from '@mui/icons-material'
import { Article, SubscriptionTierType } from '@polar-sh/sdk'
import Link from 'next/link'
import { Button, Card, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import {
  useOrganizationArticles,
  useSubscriptionStatistics,
  useSubscriptionSummary,
} from 'polarkit/hooks'
import { useMemo, useRef } from 'react'
import { useHoverDirty } from 'react-use'
import { twMerge } from 'tailwind-merge'

const startOfMonth = new Date()
startOfMonth.setUTCHours(0, 0, 0, 0)
startOfMonth.setUTCDate(1)

const startOfMonthThreeMonthsAgo = new Date()
startOfMonthThreeMonthsAgo.setUTCHours(0, 0, 0, 0)
startOfMonthThreeMonthsAgo.setUTCDate(1)
startOfMonthThreeMonthsAgo.setUTCMonth(startOfMonth.getMonth() - 2)

const ClientPage = () => {
  const { org } = useCurrentOrgAndRepoFromURL()

  const posts = useOrganizationArticles({
    orgName: org?.name,
    platform: org?.platform,
    showUnpublished: true,
  })

  const summary = useSubscriptionSummary(org?.name ?? '')
  const subscriptionStatistics = useSubscriptionStatistics(
    org?.name ?? '',
    startOfMonthThreeMonthsAgo,
    startOfMonth,
  )
  const paidSubscriptionStatistics = useSubscriptionStatistics(
    org?.name ?? '',
    startOfMonthThreeMonthsAgo,
    startOfMonth,
    [SubscriptionTierType.INDIVIDUAL, SubscriptionTierType.BUSINESS],
  )

  const currentPeriodPaidSubscriptions = useMemo(
    () =>
      paidSubscriptionStatistics.data?.periods[
        paidSubscriptionStatistics.data.periods.length - 1
      ],
    [paidSubscriptionStatistics],
  )

  const showPosts = (posts.data?.items?.length ?? 0) > 0
  const showNoPostsYet =
    !showPosts && posts.data?.items && posts.data.items.length === 0

  return (
    <>
      <DashboardBody>
        <div className="items mb-24 flex w-full flex-col-reverse items-start gap-y-12  xl:flex-row xl:gap-x-12 xl:gap-y-0">
          <div className="flex w-full flex-col gap-y-8 overflow-hidden">
            <div className="flex flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                Overview
              </h3>
              <Link
                href={`/maintainer/${org?.name}/posts/new`}
                onClick={() => captureEvent('posts:overview_create_new:click')}
              >
                <Button className="h-8 w-8 rounded-full">
                  <AddOutlined fontSize="inherit" />
                </Button>
              </Link>
            </div>
            <div className="flex flex-col gap-y-12">
              {showPosts ? (
                <StaggerReveal className="flex w-full flex-col gap-y-4">
                  {posts.data?.items
                    ? posts.data.items.map((post) => (
                        <StaggerReveal.Child key={post.id}>
                          <PostItem {...post} />
                        </StaggerReveal.Child>
                      ))
                    : null}
                </StaggerReveal>
              ) : null}

              {showNoPostsYet ? (
                <div className="dark:text-polar-500 flex h-full flex-col items-center gap-y-4 pt-32 text-gray-500">
                  <ViewDayOutlined fontSize="large" />
                  <div className="flex flex-col items-center gap-y-2">
                    <h3 className="p-2 text-lg font-medium">No posts yet</h3>
                    <p className="dark:text-polar-600 min-w-0 truncate text-gray-300">
                      Create your first post to start engaging with your
                      subscribers
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="top-8 flex flex-shrink-0 flex-col gap-y-8 xl:sticky xl:w-1/3">
            <div className="flex w-full flex-grow flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                Analytics
              </h3>
            </div>
            <div className="flex flex-shrink-0 gap-2 lg:gap-8 xl:flex-col">
              {subscriptionStatistics.data && (
                <Card className="flex flex-col gap-y-4 rounded-3xl p-4">
                  <div className="flex w-full flex-grow flex-row items-center justify-between">
                    <h3 className="p-2 text-sm font-medium">Subscribers</h3>
                    <h3 className="p-2 text-sm">
                      {summary.data?.pagination.total_count}
                    </h3>
                  </div>
                  <SubscriptionsChart
                    y="subscribers"
                    axisYOptions={{
                      ticks: 'month',
                      label: null,
                    }}
                    data={subscriptionStatistics.data.periods.map((d) => ({
                      ...d,
                      parsedStartDate: new Date(d.start_date),
                    }))}
                  />
                </Card>
              )}
              {paidSubscriptionStatistics.data && (
                <Card className="flex flex-col gap-y-4 rounded-3xl p-4">
                  <div className="flex w-full flex-grow flex-row items-center justify-between">
                    <h3 className="p-2 text-sm font-medium">
                      Paying Subscribers
                    </h3>
                    <h3 className="p-2 text-sm">
                      {currentPeriodPaidSubscriptions?.subscribers}
                    </h3>
                  </div>
                  <SubscriptionsChart
                    y="subscribers"
                    axisYOptions={{
                      ticks: 'month',
                      label: null,
                    }}
                    data={paidSubscriptionStatistics.data.periods.map((d) => ({
                      ...d,
                      parsedStartDate: new Date(d.start_date),
                    }))}
                  />
                </Card>
              )}
            </div>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage

const PostItem = (post: Article) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()
  const isHovered = useHoverDirty(ref)
  const image = firstImageUrlFromMarkdown(post.body)

  const href = `/maintainer/${currentOrg?.name}/posts/${post.slug}`

  return (
    <Link
      className="flex h-full flex-col overflow-hidden"
      ref={ref}
      href={href}
    >
      <div
        className={twMerge(
          'dark:bg-polar-900 dark:border-polar-800 dark:hover:bg-polar-800 flex flex-row justify-between gap-x-8 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-colors hover:bg-gray-50',
          post.paid_subscribers_only &&
            'border-white bg-gradient-to-l from-blue-50/80 to-transparent hover:from-blue-100 dark:from-blue-800/20 dark:hover:from-blue-800/30',
        )}
      >
        {image ? (
          <img
            src={image}
            className="hidden h-28 w-28 flex-shrink-0 rounded-2xl object-cover md:block"
          />
        ) : (
          <div
            className={twMerge(
              'dark:bg-polar-700 hidden h-28 w-28 flex-shrink-0 flex-col items-center justify-center self-start rounded-2xl bg-gray-100 bg-cover bg-center bg-no-repeat md:flex',
              post.paid_subscribers_only && 'bg-blue-50/50',
            )}
          >
            <PhotoIcon className="text-polar-400 h-8 w-8" />
          </div>
        )}
        <div className="flex min-w-0 flex-grow flex-col justify-between gap-y-6">
          <div className="flex w-full flex-col gap-y-2">
            <h3 className="text-md dark:text-polar-50 font-medium text-gray-950">
              {post.title}
            </h3>
            <div className="prose prose-headings:first:mt-0 prose-p:first:mt-0 prose-img:first:mt-0 prose-p:last:mb-0 dark:prose-pre:bg-polar-800 prose-pre:bg-gray-100 dark:prose-invert prose-pre:rounded-2xl dark:prose-headings:text-white prose-p:text-gray-700 prose-img:rounded-2xl dark:prose-p:text-polar-200 dark:text-polar-200 prose-a:text-blue-500 hover:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-a:text-blue-400 prose-a:no-underline prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-100 dark:prose-code:bg-polar-700 prose-code:font-normal prose-code:rounded-sm prose-code:px-1.5 prose-code:py-1 w-full max-w-none text-gray-600">
              <AbbreviatedBrowserRender article={post} />
            </div>
          </div>
          <div className="flex flex-row items-center justify-between whitespace-nowrap">
            <div className="dark:text-polar-300  flex w-full flex-row flex-wrap gap-x-3 text-sm text-gray-500">
              {post.published_at &&
              new Date(post.published_at) <= new Date() ? (
                <PolarTimeAgo date={new Date(post.published_at)} />
              ) : (
                <>
                  {post.published_at ? (
                    <span>
                      {post.notify_subscribers
                        ? 'Publishing and sending in'
                        : 'Publising in'}{' '}
                      <PolarTimeAgo
                        date={new Date(post.published_at)}
                        suffix=""
                      />
                    </span>
                  ) : (
                    <span>Not scheduled</span>
                  )}
                </>
              )}
              &middot;
              {post.visibility !== 'public' ? (
                <div className="flex flex-row items-center gap-x-2 text-sm">
                  <span className="capitalize">{post.visibility}</span>
                </div>
              ) : (
                <div className="flex flex-row items-center gap-x-2 text-sm">
                  {post.paid_subscribers_only ? (
                    <div className="flex flex-row items-center rounded-full bg-blue-50 bg-gradient-to-l px-2 py-0.5 dark:bg-blue-950">
                      <span className="text-xs text-blue-300 dark:text-blue-300">
                        Premium
                      </span>
                    </div>
                  ) : (
                    <>
                      <LanguageOutlined
                        className="text-blue-500"
                        fontSize="inherit"
                      />
                      <span className="capitalize">Public</span>
                    </>
                  )}
                </div>
              )}
              {post.web_view_count !== undefined ? (
                <>
                  &middot;
                  <div className="flex flex-row items-center gap-x-2 text-sm">
                    <EyeIcon className="h-4 w-4" />
                    <span>
                      {post.web_view_count}{' '}
                      {post.web_view_count === 1 ? 'view' : 'views'}
                    </span>
                  </div>
                </>
              ) : null}
              {post.email_sent_to_count ? (
                <>
                  &middot;
                  <div className="flex flex-row items-center gap-x-2 text-sm">
                    <EnvelopeIcon className="h-4 w-4" />
                    <span>
                      {post.email_sent_to_count}{' '}
                      {post.email_sent_to_count === 1
                        ? 'receiver'
                        : 'receivers'}
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="hidden flex-row items-center gap-x-4 lg:flex">
              <AnimatedIconButton
                active={isHovered}
                variant="secondary"
                href={href}
              >
                <ArrowForward fontSize="inherit" />
              </AnimatedIconButton>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
