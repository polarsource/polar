import { Subscribe } from '@/components/Embed/Subscribe'
import { getServerURL } from '@/utils/api'
import { Customer, Storefront } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
const { default: satori } = require('satori')

export const runtime = 'edge'

const getStorefront = async (org: string): Promise<Storefront> => {
  const response = await fetch(`${getServerURL()}/v1/storefronts/${org}`, {
    method: 'GET',
  })
  if (response.status === 404) {
    notFound()
  }
  return await response.json()
}

const renderBadge = async (
  customers: Customer[],
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
    const {
      customers: { customers, total },
    } = await getStorefront(org)
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
