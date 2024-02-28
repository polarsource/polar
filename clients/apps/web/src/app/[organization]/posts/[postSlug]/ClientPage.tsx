'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { useAuth } from '@/hooks/auth'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { ArrowBackOutlined } from '@mui/icons-material'

import { Article, BenefitsInner, SubscriptionTier } from '@polar-sh/sdk'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'
import { useListAllOrganizations, useUserSubscriptions } from 'polarkit/hooks'

interface PostPageProps {
  subscriptionTiers: SubscriptionTier[]
  article: Article
}

export default function Page({ article, subscriptionTiers }: PostPageProps) {
  useTrafficRecordPageView({ article })

  const { currentUser } = useAuth()

  // Check if the user is the author of the article
  const allOrganizations = useListAllOrganizations()
  const orgIds = (allOrganizations.data?.items ?? []).map((o) => o.id)

  const isAuthor =
    article.organization.is_personal && orgIds.includes(article.organization.id)

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

  const isPaidBenefit = (b: BenefitsInner) =>
    b.type === 'articles' &&
    'properties' in b &&
    'paid_articles' in b.properties &&
    b.properties['paid_articles']

  const tierWithPaidArticlesBenefit = subscriptionTiers.find((t) =>
    t.benefits.some(isPaidBenefit),
  )

  const paidArticlesBenefit =
    tierWithPaidArticlesBenefit?.benefits.find(isPaidBenefit)

  return (
    <div className="dark:md:bg-polar-900 dark:md:border-polar-800 dark:ring-polar-800 relative flex w-full flex-col items-center rounded-3xl ring-gray-100 md:bg-white md:p-12 md:shadow-sm md:ring-1 dark:md:border dark:md:ring-1">
      <Link
        className="absolute hidden flex-shrink-0 md:left-16 md:top-16 md:flex"
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
        paidArticlesBenefitName={paidArticlesBenefit?.description}
        isAuthor={isAuthor}
      />
    </div>
  )
}
