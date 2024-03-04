import { HighlightedTiers } from '@/components/Embed/HighlightedTiers'
import { ListResourceSubscriptionTier, SubscriptionTier } from '@polar-sh/sdk'
import { getServerURL } from 'polarkit/api/url'
const { default: satori } = require('satori')

export const runtime = 'edge'

const getHighlightedSubscriptions = async (
  org: string,
  limit: number = 100,
): Promise<SubscriptionTier[]> => {
  let url = `${getServerURL()}/api/v1/subscriptions/tiers/search?platform=github&organization_name=${org}&limit=${limit}`

  const response = await fetch(url, {
    method: 'GET',
  })
  const data = (await response.json()) as ListResourceSubscriptionTier
  return (
    data.items?.filter((tier) => tier.is_highlighted || tier.type === 'free') ||
    []
  )
}

const renderBadge = async (
  label: string,
  subscriptionTiers: SubscriptionTier[],
  darkmode: boolean,
) => {
  const inter500 = await fetch(
    new URL('../../../assets/fonts/Inter-Regular.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  const inter600 = await fetch(
    new URL('../../../assets/fonts/Inter-Medium.ttf', import.meta.url),
  ).then((res) => res.arrayBuffer())

  return await satori(
    <HighlightedTiers
      label={label}
      tiers={subscriptionTiers}
      darkmode={darkmode}
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
  const label =
    searchParams.get('label') ?? `Support ${org} with a subscription`
  const darkmode = searchParams.has('darkmode')

  if (!org) {
    return new Response('No org provided', { status: 400 })
  }

  try {
    const highlightedTiers = await getHighlightedSubscriptions(org)

    const svg = await renderBadge(label, highlightedTiers, darkmode)

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
