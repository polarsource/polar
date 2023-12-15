import {
  Article,
  Issue,
  ListResourceIssue,
  Organization,
  Repository,
} from '@polar-sh/sdk'
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

import OpenGraphImageArticle from '@/components/Organization/OpenGraphImageArticle'
import OpenGraphImageFunding from '@/components/Organization/OpenGraphImageFunding'
import { notFound } from 'next/navigation'
import { getServerURL } from 'polarkit/api/url'

const regularFont = fetch(
  // @ts-ignore
  new URL('/public/fonts/Inter-Regular.ttf', import.meta.url),
).then((res) => res.arrayBuffer())

const mediumFont = fetch(
  // @ts-ignore
  new URL('/public/fonts/Inter-Medium.ttf', import.meta.url),
).then((res) => res.arrayBuffer())

export const runtime = 'edge'

const renderFundingOG = async (
  org_name: string,
  repository: Repository | undefined,
  issue_count: number,
  avatar: string,
  issues: Issue[],
  largeIssue: boolean,
) => {
  const [regularFontData, mediumFontData] = await Promise.all([
    regularFont,
    mediumFont,
  ])

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
      fonts: [
        {
          name: 'Inter',
          data: regularFontData,
          weight: 500,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: mediumFontData,
          weight: 600,
          style: 'medium',
        },
      ],
    },
  )
}

const renderArticleOG = async (article: Article) => {
  const [regularFontData, mediumFontData] = await Promise.all([
    regularFont,
    mediumFont,
  ])

  return new ImageResponse(<OpenGraphImageArticle article={article} />, {
    height: 630,
    width: 1200,
    fonts: [
      {
        name: 'Inter',
        data: regularFontData,
        weight: 500,
      },
      {
        name: 'Inter',
        data: mediumFontData,
        weight: 600,
      },
    ],
  })
}

const listIssues = async (
  org: string,
  repo: string | null,
): Promise<ListResourceIssue> => {
  const params = new URLSearchParams()
  params.set('platform', 'github')
  params.set('organization_name', org)
  if (repo) {
    params.set('repository_name', repo)
  }
  params.set('have_badge', 'true')
  params.set('sort', 'funding_goal_desc_and_most_positive_reactions')
  return await fetch(
    `${getServerURL()}/api/v1/issues/search?${params.toString()}`,
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

const getOrg = async (org: string): Promise<Organization> => {
  return await fetch(
    `${getServerURL()}/api/v1/organizations/lookup?platform=github&organization_name=${org}`,
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

const getRepo = async (org: string, repo: string): Promise<Repository> => {
  return await fetch(
    `${getServerURL()}/api/v1/repositories/lookup?platform=github&organization_name=${org}&repository_name=${repo}`,
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

const getIssue = async (externalUrl: string): Promise<Issue> => {
  const params = new URLSearchParams()
  params.set('external_url', externalUrl)
  return await fetch(
    `${getServerURL()}/api/v1/issues/lookup?${params.toString()}`,
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

const getArticle = async (id: string): Promise<Article> => {
  return await fetch(`${getServerURL()}/api/v1/articles/${id}`, {
    method: 'GET',
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Unexpected ${response.status} status code`)
    }
    return response.json()
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Article image
  try {
    const articleId = searchParams.get('articleId')
    if (articleId) {
      const articleData = await getArticle(articleId)
      return renderArticleOG(articleData)
    }
  } catch (error) {
    console.log(error)
    return new Response(`Failed to generate article OG image`, {
      status: 500,
    })
  }

  // Funding image
  try {
    const org = searchParams.get('org')
    if (!org) {
      throw new Error('no org')
    }

    const repo = searchParams.get('repo')
    const number = searchParams.get('number')

    let orgData: Organization | undefined
    let repoData: Repository | undefined
    let issueData: Issue | undefined

    if (org && repo && number) {
      issueData = await getIssue(
        `https://github.com/${org}/${repo}/issues/${number}`,
      )
      repoData = issueData.repository
      orgData = repoData.organization
    } else if (org && repo) {
      repoData = await getRepo(org, repo)
      orgData = repoData.organization
    } else if (org) {
      orgData = await getOrg(org)
    }

    if (!orgData) {
      notFound()
    }

    let issues: Issue[] = []
    let largeIssue = false
    let total_issue_count = 0

    if (issueData) {
      issues = [issueData]
      largeIssue = true
    } else {
      const res = await listIssues(org, repo)
      if (res.items) {
        issues = res.items
        total_issue_count = res.pagination.total_count
      }
    }

    return await renderFundingOG(
      orgData.name,
      repoData,
      total_issue_count,
      orgData.avatar_url,
      issues,
      largeIssue,
    )
  } catch (error) {
    console.log(error)
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}
