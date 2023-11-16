'use client'

import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import {
  NewsletterPost,
  Post,
  PostType,
  getFeed,
  isRecommendation,
} from '@/components/Feed/data'
import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { SubscriptionsChart } from '@/components/Subscriptions/SubscriptionsChart'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { EyeIcon } from '@heroicons/react/24/outline'
import {
  AddOutlined,
  ArrowForward,
  ChatBubbleOutline,
  LanguageOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { api } from 'polarkit'
import { Button, Card, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import { getCentsInDollarString } from 'polarkit/money'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useHoverDirty } from 'react-use'

const sampleAnalyticsData = [
  {
    start_date: '2023-05-01',
    end_date: '2023-06-01',
    subscribers: 21,
    mrr: 324,
    cumulative: 2870,
  },
  {
    start_date: '2023-06-01',
    end_date: '2023-07-01',
    subscribers: 36,
    mrr: 563,
    cumulative: 3670,
  },
  {
    start_date: '2023-07-01',
    end_date: '2023-08-01',
    subscribers: 118,
    mrr: 791,
    cumulative: 4570,
  },
  {
    start_date: '2023-08-01',
    end_date: '2023-09-01',
    subscribers: 72,
    mrr: 1157,
    cumulative: 5570,
  },
  {
    start_date: '2023-09-01',
    end_date: '2023-10-01',
    subscribers: 55,
    mrr: 391,
    cumulative: 6670,
  },
  {
    start_date: '2023-10-01',
    end_date: '2023-11-01',
    subscribers: 43,
    mrr: 430,
    cumulative: 7870,
  },
]

const ClientPage = () => {
  const [posts, setPosts] = useState<Post[]>([])
  useEffect(() => {
    getFeed(api).then((feed) =>
      setPosts(
        feed
          .filter((entity) => !isRecommendation(entity))
          .filter((post) => post.type === PostType.Newsletter) as Post[],
      ),
    )
  }, [])

  return (
    <>
      <DashboardBody>
        <div className="items mb-24 flex flex-row items-start gap-x-12">
          <div className="flex w-2/3 flex-col gap-y-8">
            <div className="flex w-full flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                Overview
              </h3>
              <Button className="h-8 w-8 rounded-full">
                <AddOutlined fontSize="inherit" />
              </Button>
            </div>
            <div className="flex flex-col gap-y-12">
              <StaggerReveal className="flex w-full flex-col gap-y-6">
                {posts.map((post) => (
                  <StaggerReveal.Child key={post.slug}>
                    <PostItem {...(post as NewsletterPost)} />
                  </StaggerReveal.Child>
                ))}
              </StaggerReveal>
            </div>
          </div>
          <div className="flex w-1/3 flex-col gap-y-8">
            <div className="flex w-full flex-grow flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg text-gray-950">
                Analytics
              </h3>
            </div>
            <Card className="flex flex-col gap-y-4 rounded-3xl p-4 ">
              <div className="flex w-full flex-grow flex-row items-center justify-between">
                <h3 className="p-2 text-sm font-medium">Unique views</h3>
                <h3 className="p-2 text-sm">322k this month</h3>
              </div>
              <SubscriptionsChart
                y="mrr"
                axisYOptions={{
                  ticks: 'month',
                  label: null,
                  tickFormat: (t, i) =>
                    `$${getCentsInDollarString(t, undefined, true)}`,
                }}
                data={sampleAnalyticsData.map((d) => ({
                  ...d,
                  parsedStartDate: new Date(d.start_date),
                }))}
              />
            </Card>
            <Card className="flex flex-col gap-y-4 rounded-3xl p-4">
              <div className="flex w-full flex-grow flex-row items-center justify-between">
                <h3 className="p-2 text-sm font-medium">Subscribers</h3>
                <h3 className="p-2 text-sm">1,242</h3>
              </div>
              <SubscriptionsChart
                y="subscribers"
                axisYOptions={{
                  ticks: 'month',
                  label: null,
                }}
                data={sampleAnalyticsData.map((d) => ({
                  ...d,
                  parsedStartDate: new Date(d.start_date),
                }))}
              />
            </Card>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage

const PostItem = (post: NewsletterPost) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()
  const isHovered = useHoverDirty(ref)

  const impressions = useMemo(() => Math.round(Math.random() * 100), [])
  const comments = useMemo(() => Math.round(Math.random() * 100), [])

  return (
    <Link ref={ref} href={`/maintainer/${currentOrg?.name}/posts/${post.slug}`}>
      <div className="dark:bg-polar-900 dark:border-polar-700 dark:hover:bg-polar-800 flex flex-row justify-between rounded-3xl border border-gray-100 bg-white px-8 py-6 shadow-sm transition-colors hover:bg-blue-50/50">
        <div className="flex w-full flex-col gap-y-6">
          <div className="flex w-full flex-col gap-y-2">
            <h3 className="text-md dark:text-polar-50 font-medium text-gray-950">
              {post.newsletter.title}
            </h3>
            <p className="dark:text-polar-500 min-w-0 truncate text-gray-500">
              {post.newsletter.description}
            </p>
          </div>
          <div className="flex flex-row items-center justify-between">
            <div className="dark:text-polar-300 flex w-full flex-row gap-x-3 text-sm text-gray-500">
              <PolarTimeAgo date={post.createdAt} />
              &middot;
              {post.visibility !== 'public' ? (
                <div className="flex flex-row items-center gap-x-2 text-sm">
                  <SubscriptionGroupIcon type={post.visibility} />
                  <span className="capitalize">{post.visibility}</span>
                </div>
              ) : (
                <div className="flex flex-row items-center gap-x-2 text-sm">
                  <LanguageOutlined
                    className="text-blue-500"
                    fontSize="inherit"
                  />
                  <span className="capitalize">{post.visibility}</span>
                </div>
              )}
              &middot;
              <div className="flex flex-row items-center gap-x-2 text-sm">
                <EyeIcon className="h-4 w-4" />
                <span>{impressions}k Impressions</span>
              </div>
              &middot;
              <div className="flex flex-row items-center gap-x-2 text-sm">
                <ChatBubbleOutline fontSize="inherit" />
                <span>{comments} Comments</span>
              </div>
            </div>
            <div className="flex flex-row items-center gap-x-4">
              <AnimatedIconButton active={isHovered} variant="secondary">
                <ArrowForward fontSize="inherit" />
              </AnimatedIconButton>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
