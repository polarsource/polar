'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { useAuth } from '@/hooks/auth'
import { ArrowBackOutlined } from '@mui/icons-material'

import { Article } from '@polar-sh/sdk'
import Link from 'next/link'
import { api } from 'polarkit/api'
import { Button } from 'polarkit/components/ui/atoms'
import { useUserSubscriptions } from 'polarkit/hooks'
import { useEffect } from 'react'

const postViewKey = 'posts_viewed'

export default function Page({ article }: { article: Article }) {
  useEffect(() => {
    // Track view
    try {
      const views = JSON.parse(localStorage.getItem(postViewKey) ?? '{}')

      // already viewed by user, skip tracking
      if (views[article.id]) {
        return
      }

      views[article.id] = '1'
      localStorage.setItem(postViewKey, JSON.stringify(views))

      // record page view
      api.articles.viewed({ id: article.id })
    } catch (e) {
      console.error(e)
    }
  }, [article])

  const { currentUser } = useAuth()

  const userSubs = useUserSubscriptions(
    currentUser?.id,
    article.organization.name,
    30,
    article.organization.platform,
  )

  const subscription = (userSubs.data?.items ?? []).find(
    (s) => s.subscription_tier.organization_id === article.organization.id,
  )

  const isSubscriber = subscription ? true : false

  const articleBenefits =
    subscription?.subscription_tier.benefits.filter(
      (b) => b.type === 'articles',
    ) ?? []

  const hasPaidArticlesBenefit = articleBenefits.some(
    (b) => 'paid_articles' in b.properties && b.properties['paid_articles'],
  )

  return (
    <div className="dark:md:bg-polar-900 dark:md:border-polar-800 relative flex w-full flex-col items-center rounded-3xl md:bg-white md:p-12 md:shadow-xl dark:md:border">
      <Link
        className="absolute left-0 top-4 flex flex-shrink md:left-16 md:top-16"
        href={`/${article.organization.name}`}
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
        article={article}
        isSubscriber={isSubscriber}
        hasPaidArticlesBenefit={hasPaidArticlesBenefit}
        showPaywalledContent={true} // Can safely be true. If the user doesn't have permissions to see the paywalled content it will already be stripped out.
        animation={false}
        showShare={true}
      />
    </div>
  )
}
