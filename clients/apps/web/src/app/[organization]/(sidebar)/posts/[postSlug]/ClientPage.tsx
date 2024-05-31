'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { organizationPageLink } from '@/utils/nav'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { ArrowBackOutlined } from '@mui/icons-material'

import {
  useListAllOrganizations,
  useUserBenefits,
  useUserSubscriptions,
} from '@/hooks/queries'
import { Article, BenefitPublicInner, Product } from '@polar-sh/sdk'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'

interface PostPageProps {
  products: Product[]
  article: Article
}

export default function Page({ article, products }: PostPageProps) {
  useTrafficRecordPageView({ article })

  // Check if the user is the author of the article
  const allOrganizations = useListAllOrganizations()
  const orgIds = (allOrganizations.data?.items ?? []).map((o) => o.id)

  const isAuthor =
    article.organization.is_personal && orgIds.includes(article.organization.id)

  const userSubs = useUserSubscriptions({
    organizationId: article.organization.id,
    active: true,
    limit: 100,
  })

  const subscription = (userSubs.data?.items ?? []).find(
    (s) => s.product.organization_id === article.organization.id,
  )

  const isSubscriber = subscription ? true : false

  const { data: benefits } = useUserBenefits({
    type: 'articles',
    organizationId: article.organization.id,
    limit: 100,
  })
  const hasPaidArticlesBenefit =
    benefits?.items?.some(
      (b) => b.type === 'articles' && b.properties.paid_articles,
    ) || false

  const isPaidBenefit = (b: BenefitPublicInner) =>
    b.type === 'articles' &&
    'properties' in b &&
    'paid_articles' in b.properties &&
    b.properties['paid_articles']

  const tierWithPaidArticlesBenefit = products.find((t) =>
    t.benefits.some(isPaidBenefit),
  )

  const paidArticlesBenefit =
    tierWithPaidArticlesBenefit?.benefits.find(isPaidBenefit)

  if (!article.organization.feature_settings?.articles_enabled) {
    return redirect(organizationPageLink(article.organization))
  }

  return (
    <div className="dark:md:bg-polar-900 dark:md:border-polar-800 dark:ring-polar-800 relative flex w-full flex-col items-center rounded-3xl ring-gray-100 md:bg-white md:p-12 md:shadow-sm md:ring-1 dark:md:border dark:md:ring-1">
      <Link
        className="absolute hidden flex-shrink-0 md:left-16 md:top-16 md:flex"
        href={organizationPageLink(article.organization)}
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
        showShare={true}
        paidArticlesBenefitName={paidArticlesBenefit?.description}
        isAuthor={isAuthor}
      />
    </div>
  )
}
