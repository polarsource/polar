import {
  Issue,
  ListResourceIssue,
  ListResourceRepository,
  Organization,
  Repository,
  Storefront,
} from '@polar-sh/sdk'
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

import OpenGraphImageCreator from '@/components/Organization/OpenGraphImageCreator'
import OpenGraphImageFunding from '@/components/Organization/OpenGraphImageFunding'
import { getServerURL } from '@/utils/api'
import { notFound } from 'next/navigation'

export const runtime = 'edge'

const renderFundingOG = async (
  org_name: string,
  repository: Repository | undefined,
  issue_count: number,
  avatar: string | null,
  issues: Issue[],
  largeIssue: boolean,
) => {
  // const [interRegular, interMedium] = await Promise.all([
  //   fetch(`https://polar.sh/fonts/Inter-Regular.ttf`).then((res) =>
  //     res.arrayBuffer(),
  //   ),
  //   fetch(`https://polar.sh/fonts/Inter-Medium.ttf`).then((res) =>
  //     res.arrayBuffer(),
  //   ),
  // ])

  return new ImageResponse(
    (
      <OpenGraphImageFunding
        org_name={org_name}
        repo_name={repository?.name}
        issue_count={issue_count}
        avatar={avatar}
        issues={issues}
        largeIssue={largeIssue}
      />
    ),
    {
      height: 630,
      width: 1200,
      // fonts: [
      //   {
      //     name: 'Inter',
      //     data: interRegular,
      //     weight: 500,
      //     style: 'normal',
      //   },
      //   {
      //     name: 'Inter',
      //     data: interMedium,
      //     weight: 600,
      //   },
      // ],
    },
  )
}
const renderCreatorOG = async (organization: Organization) => {
  // const [interRegular, interMedium] = await Promise.all([
  //   fetch(`https://polar.sh/fonts/Inter-Regular.ttf`).then((res) =>
  //     res.arrayBuffer(),
  //   ),
  //   fetch(`https://polar.sh/fonts/Inter-Medium.ttf`).then((res) =>
  //     res.arrayBuffer(),
  //   ),
  // ])

  return new ImageResponse(
    <OpenGraphImageCreator organization={organization} />,
    {
      height: 630,
      width: 1200,
      // fonts: [
      //   {
      //     name: 'Inter',
      //     data: interRegular,
      //     weight: 500,
      //   },
      //   {
      //     name: 'Inter',
      //     data: interMedium,
      //     weight: 600,
      //   },
      // ],
    },
  )
}

const listIssues = async (
  org: Organization,
  repo: Repository | undefined,
): Promise<ListResourceIssue> => {
  const params = new URLSearchParams()
  params.set('platform', 'github')
  params.set('organization_id', org.id)
  if (repo) {
    params.set('repository_name', repo.name)
  }
  params.set('is_badged', 'true')
  params.append('sorting', '-funding_goal')
  params.append('sorting', '-positive_reactions')
  return await fetch(`${getServerURL()}/v1/issues/?${params.toString()}`, {
    method: 'GET',
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Unexpected ${response.status} status code`)
    }
    return response.json()
  })
}

const getStorefront = async (org: string): Promise<Storefront> => {
  const response = await fetch(`${getServerURL()}/v1/storefronts/${org}`, {
    method: 'GET',
  })
  if (response.status === 404) {
    notFound()
  }
  return await response.json()
}

const getRepo = async (orgId: string, repo: string): Promise<Repository> => {
  const response = await fetch(
    `${getServerURL()}/v1/repositories/?organization_id=${orgId}&name=${repo}`,
    {
      method: 'GET',
    },
  )
  const data = (await response.json()) as ListResourceRepository

  const repository = data.items[0]

  if (!repository) {
    notFound()
  }

  return repository
}

const getIssue = async (externalUrl: string): Promise<Issue> => {
  const params = new URLSearchParams()
  params.set('external_url', externalUrl)
  return await fetch(
    `${getServerURL()}/v1/issues/lookup?${params.toString()}`,
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Funding image
  try {
    const org = searchParams.get('org')
    if (!org) {
      throw new Error('no org')
    }

    const repo = searchParams.get('repo')
    const number = searchParams.get('number')

    let repoData: Repository | undefined
    let issueData: Issue | undefined

    const { organization } = await getStorefront(org)

    if (repo && number) {
      issueData = await getIssue(
        `https://github.com/${org}/${repo}/issues/${number}`,
      )
      repoData = issueData.repository
    } else if (org && repo) {
      repoData = await getRepo(org, repo)
    } else if (org) {
      return await renderCreatorOG(organization)
    }

    let issues: Issue[] = []
    let largeIssue = false
    let total_issue_count = 0

    if (issueData) {
      issues = [issueData]
      largeIssue = true
    } else {
      const res = await listIssues(organization, repoData)
      if (res.items) {
        issues = res.items
        total_issue_count = res.pagination.total_count
      }
    }

    return await renderFundingOG(
      organization.name,
      repoData,
      total_issue_count,
      organization.avatar_url,
      issues,
      largeIssue,
    )
  } catch (error) {
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}
