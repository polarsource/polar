import { Funding } from '@polar-sh/sdk'
import { Badge } from 'polarkit/components/badge'
import { getCentsInDollarString } from 'polarkit/money'
const { default: satori } = require('satori')

export const runtime = 'edge'

const renderBadge = async ({
  amount,
  funding,
  isDarkMode,
}: {
  amount?: number
  funding: Funding
  isDarkMode: boolean
}) => {
  let hasAmount = amount !== null

  const amountRaised = amount ? getCentsInDollarString(amount) : undefined

  const inter = await fetch(
    new URL(
      '../../../../../../../../assets/fonts/Inter-Regular.ttf',
      import.meta.url,
    ),
  ).then((res) => res.arrayBuffer())

  return await satori(
    <Badge
      showAmountRaised={hasAmount}
      darkmode={isDarkMode}
      funding={funding}
      avatarsUrls={[]}
      orgName="demoorg"
    />,
    {
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

  const svg = await renderBadge({ amount, funding, isDarkMode })

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    },
    status: 200,
  })
}
