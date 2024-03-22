import { Posts } from '@/components/Embed/Posts'
import { Article, ListResourceArticle, Organization } from '@polar-sh/sdk'
import { getServerURL } from 'polarkit/api'
const { default: satori } = require('satori')

export const runtime = 'edge'

const getOrg = async (org: string): Promise<Organization> => {
  let url = `${getServerURL()}/api/v1/organizations/lookup?platform=github&organization_name=${org}`

  const response = await fetch(url, {
    method: 'GET',
  })
  const data = (await response.json()) as Organization
  return data
}

const getPosts = async (
  org: string,
  limit: number = 3,
  pinnedPosts: boolean = false,
): Promise<Article[]> => {
  let url = `${getServerURL()}/api/v1/articles/search?platform=github&organization_name=${org}&limit=${limit}&is_pinned=${pinnedPosts}`

  const response = await fetch(url, {
    method: 'GET',
  })
  const data = (await response.json()) as ListResourceArticle
  return data.items ?? []
}

const renderPost = async (
  organization: Organization,
  posts: Article[],
  darkmode: boolean,
) => {
  const inter500 = await fetch(
    new URL('../../../assets/fonts/Inter-Regular.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  const inter600 = await fetch(
    new URL('../../../assets/fonts/Inter-Medium.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  const inter700 = await fetch(
    new URL('../../../assets/fonts/Inter-Bold.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  return await satori(
    <Posts organization={organization} posts={posts} darkmode={darkmode} />,
    {
      fonts: [
        {
          name: 'Inter',
          data: inter500,
          weight: 500,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: inter600,
          weight: 600,
          style: 'medium',
        },
        {
          name: 'Inter',
          data: inter700,
          weight: 700,
          style: 'bold',
        },
      ],
    },
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const org = searchParams.get('org')
  const darkmode = searchParams.has('darkmode')

  if (!org) {
    return new Response('No org provided', { status: 400 })
  }

  try {
    const [organization, pinnedPosts, latestPosts] = await Promise.all([
      getOrg(org),
      getPosts(org, 3, true),
      getPosts(org, 3, false),
    ])

    const posts = [...pinnedPosts, ...latestPosts].slice(0, 3)

    const svg = await renderPost(organization, posts, darkmode)

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        // Cache for one hour in user's browser and Vercel cache
        'Cache-Control': 'no-cache',
      },
      status: 200,
    })
  } catch (error) {
    console.error(error)
    // Return 1x1 pixel SVG to prevent image-not-found issues in browsers
    return new Response(
      '<svg width="1" height="1" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg"></svg>',
      {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache',
        },
        status: 400,
      },
    )
  }
}
