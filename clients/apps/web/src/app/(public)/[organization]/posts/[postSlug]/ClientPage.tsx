'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { ArrowBackOutlined } from '@mui/icons-material'
import {
  Article,
  Organization,
  SubscriptionSummary,
  SubscriptionTier,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { api } from 'polarkit/api'
import { LogoType } from 'polarkit/components/brand'
import { Button, Tabs } from 'polarkit/components/ui/atoms'
import { useEffect, useState } from 'react'

const postViewKey = 'posts_viewed'

export default function Page({
  onFirstRenderTab,
  post,
  organization,
  freeSubscriptionTier,
  subscribersCount,
  subscriptionSummary,
  subscriptionTiers,
}: {
  onFirstRenderTab?: string
  post: Article
  organization: Organization
  freeSubscriptionTier: SubscriptionTier | undefined
  subscribersCount: number
  subscriptionSummary: SubscriptionSummary[]
  subscriptionTiers: SubscriptionTier[]
}) {
  useEffect(() => {
    // Track view
    const views = JSON.parse(localStorage.getItem(postViewKey) ?? '{}')

    // already viewed by user, skip tracking
    if (views[post.id]) {
      return
    }

    views[post.id] = '1'
    localStorage.setItem(postViewKey, JSON.stringify(views))

    // record page view
    api.articles.viewed({ id: post.id })
  }, [post])

  // externally controlled tabs, react to changes in searchParams and set the tab value
  const [tab, setTab] = useState(onFirstRenderTab ?? 'overview')
  const searchParams = useSearchParams()
  useEffect(() => {
    const searchTab = searchParams?.get('tab')
    if (searchTab && searchTab !== tab) {
      setTab(searchTab)
    }
  }, [searchParams, tab])

  return (
    <Tabs
      className="flex min-h-screen flex-col justify-between"
      value={tab}
      onValueChange={(v) => setTab(v)}
    >
      <div className="flex w-full flex-col items-center gap-y-16 px-4 md:px-8">
        <div className="relative flex w-full flex-row items-center justify-between gap-x-24 md:justify-normal">
          <div className="shrink-0 md:w-64">
            <a href="/">
              <LogoType />
            </a>
          </div>
          <OrganizationPublicPageNav
            basePath={`/${organization.name}`}
            shouldRenderSubscriptionsTab={subscriptionTiers.length > 0}
          />
        </div>

        <div className="relative flex w-full flex-col-reverse gap-24 pb-16 md:flex-row">
          <OrganizationPublicSidebar
            organization={organization}
            freeSubscriptionTier={freeSubscriptionTier}
            subscribersCount={subscribersCount}
            subscriptionSummary={subscriptionSummary}
          />
          <StaggerReveal className="dark:md:bg-polar-900 dark:md:border-polar-800 relative flex w-full flex-col items-center rounded-3xl md:bg-white md:p-12 md:shadow-xl dark:md:border">
            <Link
              className="absolute left-16 top-16 hidden flex-shrink md:block"
              href={`/${organization.name}`}
            >
              <Button
                size="sm"
                variant="secondary"
                className="group flex h-8 w-8 flex-col items-center justify-center rounded-full border"
              >
                <ArrowBackOutlined fontSize="inherit" />
              </Button>
            </Link>
            <LongformPost article={post} />
          </StaggerReveal>
        </div>
      </div>
    </Tabs>
  )
}
