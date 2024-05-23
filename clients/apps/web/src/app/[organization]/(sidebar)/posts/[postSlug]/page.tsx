import PreviewText, { UnescapeText } from '@/components/Feed/Markdown/preview'
import { getServerSideAPI } from '@/utils/api/serverside'
import { firstImageUrlFromMarkdown } from '@/utils/markdown'
import { redirectToCanonicalDomain } from '@/utils/nav'
import {
  Article,
  ListResourceProduct,
  Platforms,
  ResponseError,
} from '@polar-sh/sdk'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export async function generateMetadata({
  params,
}: {
  params: { organization: string; postSlug: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()

  let article: Article | undefined

  try {
    article = await api.articles.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
        slug: params.postSlug,
      },
      {
        ...cacheConfig,
        next: {
          ...cacheConfig.next,
          tags: [`articles:${params.organization}:${params.postSlug}`],
        },
      },
    )
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  if (!article) {
    notFound()
  }

  // og:description or fallback
  let description = UnescapeText(article.og_description ?? '')
  if (!description) {
    // First: I'm sorry.
    // NextJS does not allow static imports of react-dom/server, so we're importing it dynamically here instead.
    //
    // We're using ReactDOMServer to render <PreviewText> (the output is a plain string), so that we can use it as the
    // description.
    //
    // This is pretty fast so it's nothing that I'm worried about.
    const ReactDOMServer = (await import('react-dom/server')).default

    description = UnescapeText(
      ReactDOMServer.renderToStaticMarkup(<PreviewText article={article} />),
    )
  }

  // og:image or fallback
  let imageUrl = article.og_image_url
  if (!imageUrl) {
    imageUrl = firstImageUrlFromMarkdown(article.body)
  }
  if (!imageUrl) {
    imageUrl = `https://polar.sh/og?articleId=${article.id}`
  }

  return {
    title: {
      absolute: `${article.title} by ${article.byline.name}`,
    },

    description: description,

    openGraph: {
      title: `${article.title}`,
      description: `${description}`,
      siteName: 'Polar',

      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${article.title}`,
        },
      ],
      card: 'summary_large_image',
      title: `${article.title}`,
      description: `${description}`,
    },

    alternates: {
      types: {
        'application/rss+xml': [
          {
            title: `${
              article.organization.pretty_name || article.organization.name
            }`,
            url: `https://polar.sh/${article.organization.name}/rss`,
          },
        ],
      },
    },
  }
}

import { Article as JSONLDArticle, WithContext } from 'schema-dts'

export default async function Page({
  params,
}: {
  params: { organization: string; postSlug: string }
}) {
  const api = getServerSideAPI()

  let article: Article | undefined
  let products: ListResourceProduct | undefined

  try {
    article = await api.articles.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
        slug: params.postSlug,
      },
      {
        ...cacheConfig,
        next: {
          ...cacheConfig.next,
          tags: [`articles:${params.organization}:${params.postSlug}`],
        },
      },
    )
    products = await api.products.listProducts(
      { organizationId: article.organization.id, isRecurring: true },
      cacheConfig,
    )
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  if (!article) {
    notFound()
  }

  redirectToCanonicalDomain({
    organization: article.organization,
    paramOrganizationName: params.organization,
    headers: headers(),
    subPath: `/posts/${article.slug}`,
  })

  const jsonLd: WithContext<JSONLDArticle> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    articleBody: article.body,
    author: {
      '@type': 'Organization',
      name: article.byline.name,
      url: article.organization.custom_domain
        ? `https://${article.organization.custom_domain}`
        : `https://polar.sh/${article.organization.name}`,
    },
    publisher: {
      '@type': 'Organization',
      name: article.byline.name,
      url: article.organization.custom_domain
        ? `https://${article.organization.custom_domain}`
        : `https://polar.sh/${article.organization.name}`,
    },
  }

  if (article.published_at) {
    jsonLd.datePublished = new Date(article.published_at).toISOString()
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ClientPage article={article} products={products.items || []} />
    </>
  )
}
