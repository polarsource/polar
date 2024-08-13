import IssueBadge from '@/components/Embed/IssueBadge'
import { getServerSideAPI } from '@/utils/api/serverside'
import { resolveIssuePath } from '@/utils/issue'
import {
  Issue,
  Organization,
  PledgePledgesSummary,
  Pledger,
  PolarAPI,
  State,
} from '@polar-sh/sdk'
const { default: satori } = require('satori')

export const runtime = 'edge'

const cacheConfig = {
  next: { revalidate: 60 },
}

type Data = {
  issue: Issue
  organization: Organization
  pledges: PledgePledgesSummary
}

const getBadgeData = async (
  api: PolarAPI,
  org: string,
  repo: string,
  number: string,
): Promise<Data> => {
  const resolvedIssueOrganization = await resolveIssuePath(
    api,
    org,
    repo,
    number,
    cacheConfig,
  )

  if (!resolvedIssueOrganization) {
    throw new Error('Issue not found')
  }

  const [issue, organization] = resolvedIssueOrganization
  const pledges = await api.pledges.summary({ issueId: issue.id }, cacheConfig)
  return { pledges, issue, organization }
}

const renderBadge = async (data: Data, isDarkmode: boolean) => {
  const {
    pledges: { funding, pledges },
    organization,
    issue,
  } = data

  const hasAmount =
    (funding.pledges_sum?.amount && funding.pledges_sum.amount > 0) || false

  const showAmountRaised = hasAmount && organization.pledge_badge_show_amount

  const avatarUrlsSet = new Set(
    pledges
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
    issue.upfront_split_to_contributors ??
    organization.default_upfront_split_to_contributors

  return await satori(
    <IssueBadge
      showAmountRaised={showAmountRaised}
      darkmode={isDarkmode}
      funding={funding}
      avatarsUrls={Array.from(avatarUrlsSet)}
      upfront_split_to_contributors={upfront_split_to_contributors}
      orgName={issue.repository.organization.name}
      issueIsClosed={
        Boolean(issue.issue_closed_at) || issue.state === State.CLOSED
      }
      donationsEnabled={organization.donations_enabled}
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

  const api = getServerSideAPI()

  try {
    const data = await getBadgeData(api, params.org, params.repo, params.number)

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
