'use client'

import { AbbreviatedBrowserRender } from '@/components/Feed/Markdown/BrowserRender'
import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import {
  DashboardBody,
  DashboardPaddingX,
} from '@/components/Layout/DashboardLayout'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { Chart } from '@/components/Subscriptions/SubscriptionsChart'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { firstImageUrlFromMarkdown } from '@/utils/markdown'
import { captureEvent } from '@/utils/posthog'
import { prettyReferrerURL } from '@/utils/traffic'
import { EnvelopeIcon, EyeIcon } from '@heroicons/react/24/outline'
import {
  AddOutlined,
  ArrowForward,
  LanguageOutlined,
  ViewDayOutlined,
} from '@mui/icons-material'
import { Article } from '@polar-sh/sdk'
import Link from 'next/link'
import { PolarTimeAgo } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { Card } from 'polarkit/components/ui/atoms/card'
import {
  useOrganizationArticles,
  useTrafficStatistics,
  useTrafficTopReferrers,
} from 'polarkit/hooks'
import { useRef, useState } from 'react'
import { useHoverDirty } from 'react-use'
import { twMerge } from 'tailwind-merge'

const startOfMonth = new Date()
startOfMonth.setUTCHours(0, 0, 0, 0)
startOfMonth.setUTCDate(1)

const startOfMonthThreeMonthsAgo = new Date()
startOfMonthThreeMonthsAgo.setUTCHours(0, 0, 0, 0)
startOfMonthThreeMonthsAgo.setUTCDate(1)
startOfMonthThreeMonthsAgo.setUTCMonth(startOfMonth.getMonth() - 2)

const today = new Date()

function idxOrLast<T>(arr: Array<T>, idx?: number): T | undefined {
  if (idx !== undefined) {
    return arr[idx]
  }
  if (arr.length === 0) {
    return undefined
  }
  return arr[arr.length - 1]
}

const ClientPage = () => {
  const { org } = useCurrentOrgAndRepoFromURL()

  const posts = useOrganizationArticles({
    orgName: org?.name,
    platform: org?.platform,
    showUnpublished: true,
  })

  const trafficStatistics = useTrafficStatistics({
    orgName: org?.name ?? '',
    platform: org?.platform,
    startDate: startOfMonthThreeMonthsAgo,
    endDate: startOfMonth,
    interval: 'month',
  })

  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<
    number | undefined
  >()

  const currentTraffic =
    idxOrLast(trafficStatistics.data?.periods || [], hoveredPeriodIndex)
      ?.views ?? 0

  const referrers = useTrafficTopReferrers({
    orgName: org?.name ?? '',
    platform: org?.platform,
    startDate: startOfMonthThreeMonthsAgo,
    endDate: today,
    limit: 5,
  })

  const prettyReferrerrs = (referrers.data?.items ?? []).map((r) => {
    return { ...r, prettyURL: prettyReferrerURL(r) }
  })

  const showPosts = (posts.data?.items?.length ?? 0) > 0
  const showNoPostsYet =
    !showPosts && posts.data?.items && posts.data.items.length === 0

  return (
    <>
      <DashboardBody className="!p-0">
        <DashboardPaddingX className="relative !px-0 xl:!px-8">
          <div className="items mb-24 flex w-full flex-col-reverse items-start gap-y-12 xl:flex-row xl:gap-x-4 xl:gap-y-0">
            <DashboardPaddingX className="flex w-full flex-1 flex-col gap-y-8 overflow-hidden ">
              <div className="flex flex-row items-center justify-between">
                <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                  Overview
                </h3>
                <Link
                  href={`/maintainer/${org?.name}/posts/new`}
                  onClick={() =>
                    captureEvent('posts:overview_create_new:click')
                  }
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
            </DashboardPaddingX>
            <div className="lx:overflow-auto flex w-full flex-col gap-y-8 overflow-hidden xl:sticky xl:top-8 xl:w-1/3 xl:flex-shrink-0">
              <DashboardPaddingX className="flex w-full flex-grow flex-row items-center justify-between xl:!px-0">
                <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                  Analytics
                </h3>
              </DashboardPaddingX>
              <div className="flex w-full overflow-x-auto md:overflow-hidden">
                <DashboardPaddingX className="flex flex-row gap-6 md:overflow-hidden xl:flex-col xl:px-0">
                  {trafficStatistics.data && (
                    <Card className="md:min-w-inherit flex w-full min-w-[300px] flex-col gap-y-4 self-stretch p-4">
                      <div className="flex w-full flex-row items-center justify-between">
                        <h3 className="text-sm font-medium">Views</h3>
                        <span className="text-right text-sm">
                          {currentTraffic.toLocaleString()}
                        </span>
                      </div>
                      <Chart
                        y="views"
                        axisYOptions={{
                          ticks: 'month',
                          label: null,
                        }}
                        data={trafficStatistics.data.periods.map((d) => ({
                          ...d,
                          parsedStartDate: new Date(d.start_date),
                        }))}
                        onDataIndexHover={setHoveredPeriodIndex}
                        hoveredIndex={hoveredPeriodIndex}
                      />
                    </Card>
                  )}
                  {prettyReferrerrs && prettyReferrerrs.length > 0 && (
                    <Card className="justify-top  md:min-w-inherit flex w-full min-w-[300px] flex-col items-start gap-y-3 self-stretch overflow-hidden p-4">
                      <div className="flex w-full flex-row items-center justify-between">
                        <h3 className="text-sm font-medium">Top Referrers</h3>
                      </div>

                      {prettyReferrerrs.map(
                        ({ referrer, views, prettyURL }) => (
                          <div
                            key={referrer}
                            className="flex w-full flex-row items-center justify-between gap-x-4 text-sm lg:gap-x-8"
                          >
                            <span className="truncate text-gray-600">
                              {prettyURL}
                            </span>
                            <span>{views.toLocaleString()}</span>
                          </div>
                        ),
                      )}
                    </Card>
                  )}
                </DashboardPaddingX>
              </div>
            </div>
          </div>
        </DashboardPaddingX>
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
          'dark:bg-polar-900 dark:border-polar-800 dark:hover:bg-polar-800 flex flex-col justify-between gap-x-8 gap-y-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-colors hover:bg-gray-50',
          post.paid_subscribers_only &&
            'border-white bg-gradient-to-l from-blue-50/80 to-transparent hover:from-blue-100 dark:from-blue-800/20 dark:hover:from-blue-800/30',
        )}
      >
        <div className="flex w-full flex-col gap-y-6">
          <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
            {post.title}
          </h3>
          <div className="prose prose-headings:font-medium prose-headings:first:mt-0 prose-p:first:mt-0 prose-img:first:mt-0 prose-p:last:mb-0 dark:prose-pre:bg-polar-800 prose-pre:bg-gray-100 dark:prose-invert prose-pre:rounded-2xl dark:prose-headings:text-white prose-p:text-gray-700 prose-img:rounded-2xl dark:prose-p:text-polar-200 dark:text-polar-200 prose-a:text-blue-500 hover:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-a:text-blue-400 prose-a:no-underline prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-100 dark:prose-code:bg-polar-700 prose-code:font-normal prose-code:rounded-sm prose-code:px-1.5 prose-code:py-1 w-full max-w-none text-gray-600">
            <AbbreviatedBrowserRender article={post} />
          </div>
        </div>
        <div className="flex flex-row items-center justify-between whitespace-nowrap">
          <div className="dark:text-polar-300  flex w-full flex-row flex-wrap gap-x-3 text-sm text-gray-500">
            {post.published_at && new Date(post.published_at) <= new Date() ? (
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
            {post.is_pinned ? (
              <>
                &middot;
                <div className="flex flex-row items-center gap-x-2 text-sm">
                  <div className="flex flex-row items-center rounded-full bg-green-100 bg-gradient-to-l px-2 py-0.5 dark:bg-green-950">
                    <span className="text-xs text-green-400 dark:text-green-300">
                      Pinned
                    </span>
                  </div>
                </div>
              </>
            ) : null}
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
                    {post.email_sent_to_count === 1 ? 'receiver' : 'receivers'}
                  </span>
                </div>
              </>
            ) : null}
          </div>

          <div className="hidden flex-row items-center gap-x-4 lg:flex">
            <AnimatedIconButton active={isHovered} variant="secondary">
              <ArrowForward fontSize="inherit" />
            </AnimatedIconButton>
          </div>
        </div>
      </div>
    </Link>
  )
}
