import { GithubBadgeRead } from 'polarkit/api/client'
import { getServerURL } from 'polarkit/api/url'
import { Badge } from 'polarkit/components/badge'
import { getCentsInDollarString } from 'polarkit/money'
const { default: satori } = require('satori')

export const runtime = 'edge'

const getBadgeData = async (
  org: string,
  repo: string,
  number: number,
): Promise<GithubBadgeRead> => {
  const badgeType = 'pledge'
  return await fetch(
    `${getServerURL()}/api/v1/integrations/github/${org}/${repo}/issues/${number}/badges/${badgeType}`,
    {
      method: 'GET',
    },
  ).then((response) => {
    if (!response.ok) {
      throw new Error(`Unexpected ${response.status} status code`)
    }
    return response.json()
  })
}

const renderBadge = async (badge: GithubBadgeRead, isDarkmode: boolean) => {
  let hasAmount = badge.amount !== null

  const amountRaised = badge.amount
    ? getCentsInDollarString(badge.amount)
    : undefined

  const inter = await fetch(
    new URL(
      '../../../../../../../../assets/fonts/Inter-Regular.ttf',
      import.meta.url,
    ),
  ).then((res) => res.arrayBuffer())

  return await satori(
    <Badge
      showAmountRaised={hasAmount}
      amountRaised={amountRaised}
      darkmode={isDarkmode}
    />,
    {
      height: 60,
      width: 400,
      fonts: [
        {
          name: 'Inter',
          data: inter,
          weight: 500,
          style: 'normal',
        },
      ],
    },
  )
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: { org: string; repo: string; number: string; darkmode?: string }
  },
) {
  const { searchParams } = new URL(request.url)
  const isDarkMode = searchParams.has('darkmode')

  try {
    const badge = await getBadgeData(
      params.org,
      params.repo,
      parseInt(params.number),
    )

    const svg = await renderBadge(badge, isDarkMode)

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
