import IssueBadge from '@/components/Embed/IssueBadge'
import { Funding } from '@polar-sh/sdk'
const { default: satori } = require('satori')

export const runtime = 'edge'

const renderBadge = async ({
  amount,
  funding,
  isDarkMode,
  withUpfrontSplit,
}: {
  amount?: number
  funding: Funding
  isDarkMode: boolean
  withUpfrontSplit: boolean
}) => {
  let hasAmount = amount !== null

  const [interRegular] = await Promise.all([
    fetch(`https://polar.sh/fonts/Inter-Regular.ttf`).then((res) =>
      res.arrayBuffer(),
    ),
  ])

  return await satori(
    <IssueBadge
      showAmountRaised={hasAmount}
      darkmode={isDarkMode}
      funding={funding}
      avatarsUrls={[]}
      orgName="SerenityOS"
      upfront_split_to_contributors={withUpfrontSplit ? 80 : null}
      issueIsClosed={false}
      donationsEnabled={false}
    />,
    {
      width: 400,
      fonts: [
        {
          name: 'Inter',
          data: interRegular,
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
  const withUpfrontSplit = !!searchParams.get('upfrontSplit')

  const funding = {
    funding_goal: withFundingGoal
      ? { currency: 'usd', amount: 25000 }
      : undefined,
    pledges_sum: { currency: 'usd', amount: amount },
  }

  const svg = await renderBadge({
    amount,
    funding,
    isDarkMode,
    withUpfrontSplit,
  })

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    },
    status: 200,
  })
}
