import { getServerSideAPI } from '@/utils/api/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import { ArticleVisibility, ListResourceArticle } from '@polar-sh/sdk'
import type { Metadata } from 'next'
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
  params: { organization: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  return {
    title: `${organization.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `${organization.name} on Polar`,
      description: `${organization.name} on Polar`,
      siteName: 'Polar',
      type: 'website',
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `${organization.name} on Polar`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name} on Polar`,
      description: `${organization.name} on Polar`,
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  let pinnedArticles: ListResourceArticle | undefined
  let articles: ListResourceArticle | undefined

  try {
    const [loadPinnedArticles, loadArticles] = await Promise.all([
      api.articles.list(
        {
          organizationId: organization.id,
          isPublished: true,
          visibility: ArticleVisibility.PUBLIC,
          isPinned: true,
        },
        cacheConfig,
      ),
      api.articles.list(
        {
          organizationId: organization.id,
          isPublished: true,
          visibility: ArticleVisibility.PUBLIC,
          isPinned: false,
        },
        cacheConfig,
      ),
    ])
    pinnedArticles = loadPinnedArticles
    articles = loadArticles
  } catch (e) {
    notFound()
  }

  return (
    <ClientPage
      organization={organization}
      pinnedArticles={pinnedArticles}
      articles={articles}
    />
  )
}
