import { Issue, PledgePledgesSummary, Pledger } from '@polar-sh/sdk'
import { getServerURL } from 'polarkit/api'
import { Badge } from 'polarkit/components/badge'
const { default: satori } = require('satori')

export const runtime = 'edge'

type Data = {
  pledges: PledgePledgesSummary
  issue: Issue
}

const lookupIssue = (externalUrl: string): Promise<Issue> =>
  fetch(`${getServerURL()}/api/v1/issues/lookup?external_url=${externalUrl}`, {
    method: 'GET',
    next: { revalidate: 60 },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Unexpected ${response.status} status code`)
    }
    return response.json()
  })

const pledgesSummary = (issueId: string): Promise<PledgePledgesSummary> =>
  fetch(`${getServerURL()}/api/v1/pledges/summary?issue_id=${issueId}`, {
    method: 'GET',
    next: { revalidate: 60 },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Unexpected ${response.status} status code`)
    }
    return response.json()
  })

const getBadgeData = async (
  org: string,
  repo: string,
  number: number,
): Promise<Data> => {
  try {
    const issue = await lookupIssue(
      `https://github.com/${org}/${repo}/issues/${number}`,
    )

    const pledges = await pledgesSummary(issue.id)

    return { pledges, issue }
  } catch (e) {
    throw e
  }
}

const renderBadge = async (data: Data, isDarkmode: boolean) => {
  const funding = data.pledges.funding

  const hasAmount =
    (funding.pledges_sum?.amount && funding.pledges_sum.amount > 0) || false

  const showAmountRaised =
    hasAmount && data.issue.repository.organization.pledge_badge_show_amount

  const avatarUrlsSet = new Set(
    data.pledges.pledges
      .map(({ pledger }) => pledger)
      .filter((p): p is Pledger => !!p)
      .map((p) => p.avatar_url ?? '')
      .filter((s) => s.length > 0),
  )

  // Sorry
  const [interRegular, interMedium] = await Promise.all([
    fetch(`https://polar.sh/fonts/Inter-Regular.ttf`).then((res) =>
      res.arrayBuffer(),
    ),
    fetch(`https://polar.sh/fonts/Inter-Medium.ttf`).then((res) =>
      res.arrayBuffer(),
    ),
  ])

  const upfront_split_to_contributors =
    data.issue.upfront_split_to_contributors ??
    data.issue.repository.organization.default_upfront_split_to_contributors

  return await satori(
    <Badge
      showAmountRaised={showAmountRaised}
      darkmode={isDarkmode}
      funding={funding}
      avatarsUrls={Array.from(avatarUrlsSet)}
      upfront_split_to_contributors={upfront_split_to_contributors}
      orgName={data.issue.repository.organization.name}
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
        {
          name: 'Inter',
          data: interMedium,
          weight: 600,
          style: 'medium',
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
    const data = await getBadgeData(
      params.org,
      params.repo,
      parseInt(params.number),
    )

    data.issue.repository.organization.pledge_minimum_amount

    const svg = await renderBadge(data, isDarkMode)

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
