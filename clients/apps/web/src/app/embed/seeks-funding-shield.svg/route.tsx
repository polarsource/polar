import { SeeksFundingShield } from '@/components/Embed/SeeksFundingShield'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import { PolarAPI } from '@polar-sh/sdk'
const { default: satori } = require('satori')

export const runtime = 'edge'

const cacheConfig = {
  next: { revalidate: 60 },
}

const getData = async (
  api: PolarAPI,
  organizationSlug: string,
  repositoryName: string | undefined,
): Promise<number> => {
  const organization = await getOrganizationBySlug(
    api,
    organizationSlug,
    cacheConfig,
  )

  if (!organization) {
    throw new Error('Organization not found')
  }

  const {
    pagination: { total_count },
  } = await api.issues.list({
    organizationId: organization.id,
    isBadged: true,
    limit: 1,
    ...(repositoryName ? { repositoryName } : {}),
  })

  return total_count
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

  const api = getServerSideAPI()

  try {
    const data = await getData(api, org, repo || undefined)
    const svg = await renderBadge(data)

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
