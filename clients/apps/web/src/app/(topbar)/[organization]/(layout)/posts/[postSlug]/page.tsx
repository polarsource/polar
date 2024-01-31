import PreviewText, { UnescapeText } from '@/components/Feed/Markdown/preview'
import { getServerSideAPI } from '@/utils/api'
import { firstImageUrlFromMarkdown } from '@/utils/markdown'
import {
  Article,
  ListResourceSubscriptionTier,
  Platforms,
  ResponseError,
} from '@polar-sh/sdk'
import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export async function generateMetadata(
  {
    params,
  }: {
    params: { organization: string; postSlug: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const api = getServerSideAPI()

  let article: Article | undefined

  try {
    article = await api.articles.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
        slug: params.postSlug,
      },
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

  // First: I'm sorry.
  // NextJS does not allow static imports of react-dom/server, so we're importing it dynamically here instead.
  //
  // We're using ReactDOMServer to render <PreviewText> (the output is a plain string), so that we can use it as the
  // description.
  //
  // This is pretty fast so it's nothing that I'm worried about.
  const ReactDOMServer = (await import('react-dom/server')).default

  const preview = UnescapeText(
    ReactDOMServer.renderToStaticMarkup(<PreviewText article={article} />),
  )

  const image = firstImageUrlFromMarkdown(article.body)

  return {
    title: {
      absolute: `${article.title} by ${article.byline.name}`,
    },

    description: preview,

    openGraph: {
      title: `${article.title}`,
      description: `${preview}`,
      siteName: 'Polar',

      images: [
        {
          url: image ?? `https://polar.sh/og?articleId=${article.id}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: image ?? `https://polar.sh/og?articleId=${article.id}`,
          width: 1200,
          height: 630,
          alt: `${article.title}`,
        },
      ],
      card: 'summary_large_image',
      title: `${article.title}`,
      description: `${preview}`,
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

export default async function Page({
  params,
}: {
  params: { organization: string; postSlug: string }
}) {
  const api = getServerSideAPI()

  let article: Article | undefined
  let subscriptionTiers: ListResourceSubscriptionTier | undefined

  try {
    ;[article, subscriptionTiers] = await Promise.all([
      await api.articles.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
          slug: params.postSlug,
        },
        cacheConfig,
      ),

      await api.subscriptions.searchSubscriptionTiers(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        cacheConfig,
      ),
    ])
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

  return (
    <ClientPage
      article={article}
      subscriptionTiers={subscriptionTiers.items || []}
    />
  )
}
