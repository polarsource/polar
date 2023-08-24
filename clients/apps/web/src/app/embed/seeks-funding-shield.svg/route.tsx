import { SeeksFundingShield } from '@/components/Embed/SeeksFundingShield'
import { ListResource_Issue_ } from 'polarkit/api/client'
import { getServerURL } from 'polarkit/api/url'
const { default: satori } = require('satori')

export const runtime = 'edge'

const getData = async (
  org: string,
  repo?: string,
): Promise<ListResource_Issue_> => {
  let url = `${getServerURL()}/api/v1/issues/search?platform=github&organization_name=${org}&sort=funding_goal_desc_and_most_positive_reactions&have_badge=true`

  if (repo) {
    url += `&repository_name=${repo}`
  }

  return await fetch(url, {
    method: 'GET',
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Unexpected ${response.status} status code`)
    }
    return response.json()
  })
}

const renderBadge = async (count: number) => {
  const inter = await fetch(
    new URL('../../../assets/fonts/Inter-Regular.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  return await satori(<SeeksFundingShield count={count} />, {
    fonts: [
      {
        name: 'Inter',
        data: inter,
        weight: 500,
        style: 'normal',
      },
    ],
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const org = searchParams.get('org')
  const repo = searchParams.get('repo')

  if (!org) {
    return new Response('No org provided', { status: 400 })
  }

  try {
    const data = await getData(org, repo || undefined)
    const svg = await renderBadge(data.pagination.total_count)

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
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
