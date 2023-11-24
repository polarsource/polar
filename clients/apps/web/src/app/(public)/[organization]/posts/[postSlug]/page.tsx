import { getServerSideAPI } from '@/utils/api'
import { Article, Platforms, ResponseError } from '@polar-sh/sdk'
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

  let post: Article | undefined

  try {
    post = await api.articles.lookup({
      platform: Platforms.GITHUB,
      organizationName: params.organization,
      slug: params.postSlug,
    })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    }
  }

  if (!post) {
    notFound()
  }

  return {
    title: {
      absolute: `${post.title} by ${post.byline.name}`,
    },

    openGraph: {
      title: `${post.title}`,
      description: `${post.title} by ${post.byline.name}`,
      siteName: 'Polar',

      images: [
        {
          url: `https://polar.sh/og?org=${post.organization.name}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${post.organization.name}`,
          width: 1200,
          height: 630,
          alt: `${post.title}`,
        },
      ],
      card: 'summary_large_image',
      title: `${post.title}`,
      description: `${post.title} by ${post.byline.name}`,
    },
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string; postSlug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const api = getServerSideAPI()

  const post = await api.articles.lookup({
    platform: Platforms.GITHUB,
    organizationName: params.organization,
    slug: params.postSlug,
  })

  return <>{post && <ClientPage post={post} />}</>
}
