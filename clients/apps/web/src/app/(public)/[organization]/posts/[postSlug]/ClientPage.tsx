'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { ArrowBackOutlined } from '@mui/icons-material'
import {
  Article,
  Organization,
  SubscriptionSummary,
  SubscriptionTier,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { api } from 'polarkit/api'
import { LogoType } from 'polarkit/components/brand'
import { Button } from 'polarkit/components/ui/atoms'
import { useEffect } from 'react'

const postViewKey = 'posts_viewed'

export default function Page({
  post,
  organization,
  freeSubscriptionTier,
  subscribersCount,
  subscriptionSummary,
}: {
  post: Article
  organization: Organization
  freeSubscriptionTier: SubscriptionTier | undefined
  subscribersCount: number
  subscriptionSummary: SubscriptionSummary[]
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
  }, [])

  return (
    <div className="flex w-full flex-col items-center gap-y-16 px-4 md:px-8">
      <div className="flex w-full flex-row items-center justify-between">
        <Link href="/">
          <LogoType />
        </Link>
        <div>
          <ProfileMenu />
        </div>
      </div>
      <div className="relative flex w-full flex-col-reverse gap-24 pb-16 md:flex-row">
        <OrganizationPublicSidebar
          organization={organization}
          freeSubscriptionTier={freeSubscriptionTier}
          subscribersCount={subscribersCount}
          subscriptionSummary={subscriptionSummary}
        />
        <StaggerReveal className="dark:md:bg-polar-800 dark:md:border-polar-700 relative flex w-full flex-col items-center rounded-3xl md:bg-white md:p-12 md:shadow-xl dark:md:border">
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
  )
}
