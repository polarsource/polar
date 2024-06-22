import LongformPost from '@/components/Feed/LongformPost'
import { organizationPageLink } from '@/utils/nav'
import { ArrowBackOutlined } from '@mui/icons-material'

import { BrowserServerRender } from '@/components/Feed/Markdown/Render/BrowserServerRender'
import { getHighlighter } from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterServer'
import { getServerSideAPI } from '@/utils/api/serverside'
import { Article, BenefitPublicInner, Product } from '@polar-sh/sdk'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'

interface PostPageProps {
  products: Product[]
  article: Article
}

export default async function Page({ article, products }: PostPageProps) {
  const api = getServerSideAPI()
  // Check if the user is the author of the article
  let isAuthor = false
  try {
    const allOrganizations = await api.organizations.list()
    const orgIds = allOrganizations.items?.map((org) => org.id) || []
    isAuthor =
      article.organization.is_personal &&
      orgIds.includes(article.organization.id)
  } catch (err) {}

  // Check if the user is subscriber
  let isSubscriber = false
  try {
    const userSubs = await api.users.listSubscriptions({
      organizationId: article.organization.id,
      active: true,
      limit: 100,
    })
    const subscription = (userSubs.items ?? []).find(
      (s) => s.product.organization_id === article.organization.id,
    )
    isSubscriber = subscription !== undefined
  } catch (err) {}

  // Check if the user has access to paid articles
  let hasPaidArticlesBenefit = false
  try {
    const benefits = await api.users.listBenefits({
      type: 'articles',
      organizationId: article.organization.id,
      limit: 100,
    })
    hasPaidArticlesBenefit =
      benefits?.items?.some(
        (b) => b.type === 'articles' && b.properties.paid_articles,
      ) || false
  } catch (err) {}

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

  const highlighter = await getHighlighter()

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
        showShare={true}
        isAuthor={isAuthor}
      >
        <BrowserServerRender
          article={article}
          showPaywalledContent={true} // Can safely be true. If the user doesn't have permissions to see the paywalled content it will already be stripped out.
          isSubscriber={isSubscriber}
          paidArticlesBenefitName={paidArticlesBenefit?.description}
          highlighter={highlighter}
        />
      </LongformPost>
    </div>
  )
}
