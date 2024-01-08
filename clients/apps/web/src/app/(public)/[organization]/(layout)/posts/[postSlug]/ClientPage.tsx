'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { useAuth } from '@/hooks/auth'
import { ArrowBackOutlined } from '@mui/icons-material'
import { Article, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { api } from 'polarkit/api'
import { Button } from 'polarkit/components/ui/atoms'
import { useUserSubscriptions } from 'polarkit/hooks'
import { useEffect } from 'react'

const postViewKey = 'posts_viewed'

export default function Page({
  post,
  organization,
}: {
  post: Article
  organization: Organization
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

  const { currentUser } = useAuth()

  const userSubs = useUserSubscriptions(
    currentUser?.id,
    post.organization.name,
    true,
    30,
    post.organization.platform,
  )

  const isSubscriber =
    (userSubs.data?.items && userSubs.data.items?.length > 0) ?? false

  return (
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
      <LongformPost
        article={post}
        isSubscriber={isSubscriber}
        showPaywalledContent={true} // Can safely be true. If the user doesn't have permissions to see the paywalled content it will already be stripped out.
      />
    </StaggerReveal>
  )
}
