import EmailRender from '@/components/Feed/Markdown/EmailRender'
import { getServerSideAPI } from '@/utils/api'
import { organizationPageLink } from '@/utils/nav'
import { Platforms } from '@polar-sh/sdk'
import { NextRequest, NextResponse } from 'next/server'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

import RSS from 'rss'

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: { organization: string }
  },
): Promise<NextResponse> {
  const api = getServerSideAPI(
    req.nextUrl.searchParams.get('auth') || undefined,
  )

  const [organization, articles] = await Promise.all([
    api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    ),
    await api.articles.search(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    ),
  ])

  const feed = new RSS({
    title: organization.pretty_name || organization.name,
    feed_url: `https://polar.sh/${organization.name}/rss`,
    site_url: organizationPageLink(organization),
    generator: 'polar.sh',
    image_url: organization.avatar_url,
  })

  const ReactDOMServer = (await import('react-dom/server')).default

  for (const article of articles.items || []) {
    const preview = ReactDOMServer.renderToStaticMarkup(
      <EmailRender article={article} />,
    )

    feed.item({
      title: article.title,
      description: preview,
      url: organizationPageLink(organization, `posts/${article.slug}`),
      date: article.published_at ? new Date(article.published_at) : new Date(),
    })
  }
  return new NextResponse(feed.xml(), {
    status: 200,
    headers: { 'Content-Type': 'application/rss+xml' },
  })
}
