import { Subscribe } from '@/components/Embed/Subscribe'
import { getServerURL } from '@/utils/api'
import {
  ListResourceOrganization,
  ListResourceOrganizationCustomer,
  Organization,
  OrganizationCustomer,
  OrganizationCustomerType,
  OrganizationSubscribePromoteSettings,
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

  const organization = data.items[0]

  if (!organization) {
    notFound()
  }

  return organization
}

const getCustomers = async (
  org: string,
  limit: number = 3,
): Promise<[OrganizationCustomer[], number]> => {
  const { id: orgId, profile_settings } = await getOrg(org)

  const settings: OrganizationSubscribePromoteSettings =
    profile_settings?.subscribe ?? {
      promote: true,
      show_count: true,
      count_free: true,
    }
  if (!settings.show_count) {
    return [[], 0]
  }

  const apiBase = `${getServerURL()}/v1`
  const requestURL = new URL(`${apiBase}/organizations/${orgId}/customers`)
  requestURL.searchParams.append(
    'customer_types',
    OrganizationCustomerType.PAID_SUBSCRIPTION,
  )
  if (settings.count_free) {
    requestURL.searchParams.append(
      'customer_types',
      OrganizationCustomerType.FREE_SUBSCRIPTION,
    )
  }
  requestURL.searchParams.set('limit', limit.toString())

  const response = await fetch(requestURL.toString(), {
    method: 'GET',
  })
  const data = (await response.json()) as ListResourceOrganizationCustomer
  return [data.items || [], data.pagination.total_count]
}

const renderBadge = async (
  customers: OrganizationCustomer[],
  totalCustomers: number,
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
      customers={customers}
      totalCustomers={totalCustomers}
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
    const [customers, total] = await getCustomers(org)
    const svg = await renderBadge(customers, total, label, darkmode)

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
