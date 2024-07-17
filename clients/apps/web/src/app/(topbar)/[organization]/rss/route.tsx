import EmailRender from '@/components/Feed/Markdown/Render/EmailRender'
import { getHighlighter } from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterServer'
import { getServerSideAPI } from '@/utils/api/serverside'
import { organizationPageLink } from '@/utils/nav'
import { getOrganizationBySlug } from '@/utils/organization'
import { ArticleVisibility } from '@polar-sh/sdk'
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

  const organization = await getOrganizationBySlug(
    api,
    params.organization,
    cacheConfig,
  )

  if (!organization) {
    return new NextResponse(null, { status: 404 })
  }

  const articles = await api.articles.list(
    {
      organizationId: organization.id,
      isPublished: true,
      visibility: ArticleVisibility.PUBLIC,
    },
    cacheConfig,
  )

  const feed = new RSS({
    title: organization.pretty_name || organization.slug,
    feed_url: `https://polar.sh/${organization.slug}/rss`,
    site_url: organizationPageLink(organization),
    generator: 'polar.sh',
    image_url: organization.avatar_url,
  })

  const ReactDOMServer = (await import('react-dom/server')).default
  const highlighter = await getHighlighter()

  for (const article of articles.items || []) {
    const preview = ReactDOMServer.renderToStaticMarkup(
      <EmailRender article={article} highlighter={highlighter} />,
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
