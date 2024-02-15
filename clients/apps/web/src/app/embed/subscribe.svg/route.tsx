import { Subscribe } from '@/components/Embed/Subscribe'
import {
  ListResourceSubscriptionSummary,
  Organization,
  SubscriptionSummary,
} from '@polar-sh/sdk'
import { getServerURL } from 'polarkit/api/url'
const { default: satori } = require('satori')

export const runtime = 'edge'

const getSubscriptions = async (
  org: string,
  limit: number = 3,
): Promise<[SubscriptionSummary[], number]> => {
  let url = `${getServerURL()}/api/v1/subscriptions/subscriptions/summary?platform=github&organization_name=${org}&limit=${limit}`

  const response = await fetch(url, {
    method: 'GET',
  })
  const data = (await response.json()) as ListResourceSubscriptionSummary
  return [data.items || [], data.pagination.total_count]
}

const getOrganization = async (org: string): Promise<Organization> => {
  let url = `${getServerURL()}/api/v1/organizations/lookup?platform=github&organization_name=${org}`

  return await fetch(url, {
    method: 'GET',
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Unexpected ${response.status} status code`)
    }
    return response.json()
  })
}

const renderBadge = async (
  subscriptions: SubscriptionSummary[],
  totalSubscriptions: number,
  label: string,
  darkmode: boolean,
) => {
  const inter500 = await fetch(
    new URL('../../../assets/fonts/Inter-Regular.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  const inter600 = await fetch(
    new URL('../../../assets/fonts/Inter-Medium.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  return await satori(
    <Subscribe
      subscriptions={subscriptions}
      totalSubscriptions={totalSubscriptions}
      darkmode={darkmode}
      label={label}
    />,
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
      ],
    },
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const org = searchParams.get('org')
  const label = searchParams.get('label') || 'Subscribe'
  const darkmode = searchParams.has('darkmode')

  if (!org) {
    return new Response('No org provided', { status: 400 })
  }

  try {
    const [subscriptions, total] = await getSubscriptions(org)
    const svg = await renderBadge(subscriptions, total, label, darkmode)

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        // Cache for one hour in user's browser and Vercel cache
        'Cache-Control': 'max-age=3600, s-maxage=3600',
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
