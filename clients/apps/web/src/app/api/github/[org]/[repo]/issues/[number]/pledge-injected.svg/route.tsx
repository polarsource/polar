import { GithubBadgeRead } from 'polarkit/api/client'
import { Badge } from 'polarkit/components/badge'
import { getCentsInDollarString } from 'polarkit/money'
const { default: satori } = require('satori')

export const runtime = 'edge'

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
      darkmode={isDarkmode}
      funding={badge.funding}
      avatarsUrls={[]}
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const isDarkMode = searchParams.has('darkmode')
  const amt = searchParams.get('amount')
  const amount = amt ? parseInt(amt) : 0

  const withFundingGoal = searchParams.get('fundingGoal')

  const funding = {
    funding_goal: withFundingGoal
      ? { currency: 'USD', amount: 25000 }
      : undefined,
    pledges_sum: { currency: 'USD', amount: amount },
  }

  const badge: GithubBadgeRead = {
    badge_type: GithubBadgeRead.badge_type.PLEDGE,
    amount,
    funding,
  }

  const svg = await renderBadge(badge, isDarkMode)

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    },
    status: 200,
  })
}
