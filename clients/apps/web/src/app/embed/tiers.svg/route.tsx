import { HighlightedTiers } from '@/components/Embed/HighlightedTiers'
import { getServerURL } from '@/utils/api'
import {
  ListResourceOrganization,
  ListResourceProduct,
  Organization,
  Product,
  ProductPriceRecurringInterval,
} from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
const { default: satori } = require('satori')

export const runtime = 'edge'

const getOrg = async (org: string): Promise<Organization> => {
  let url = `${getServerURL()}/v1/organizations/?slug=${org}&limit=1`

  const response = await fetch(url, {
    method: 'GET',
  })
  const data = (await response.json()) as ListResourceOrganization

  const organization = data.items?.[0]

  if (!organization) {
    notFound()
  }

  return organization
}

const getHighlightedSubscriptions = async (
  org: string,
  limit: number = 100,
): Promise<Product[]> => {
  const { id: orgId } = await getOrg(org)

  let url = getServerURL(
    `/v1/products/?organization_id=${orgId}&is_recurring=true&is_archived=false&limit=${limit}`,
  )

  const response = await fetch(url, {
    method: 'GET',
  })
  const d = (await response.json()) as ListResourceProduct
  return (
    d.items?.filter((tier) => tier.is_highlighted || tier.type === 'free') || []
  )
}

const renderBadge = async (
  label: string,
  products: Product[],
  recurringInterval: ProductPriceRecurringInterval,
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
      tiers={products}
      recurringInterval={recurringInterval}
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
  const recurringInterval =
    searchParams.get('interval') || ProductPriceRecurringInterval.MONTH

  if (!org) {
    return new Response('No org provided', { status: 400 })
  }

  try {
    const highlightedTiers = await getHighlightedSubscriptions(org)

    const svg = await renderBadge(
      label,
      highlightedTiers,
      recurringInterval as ProductPriceRecurringInterval,
      darkmode,
    )

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
