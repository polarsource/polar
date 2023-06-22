import OpenGraphImage from '@/components/Organization/OpenGraphImage'
import { ImageResponse, NextRequest } from 'next/server'
import {
  IssuePublicRead,
  OrganizationPublicPageRead,
  RepositoryPublicRead,
} from 'polarkit/api/client'

export const runtime = 'edge'

const getServerURL = (path?: string): string => {
  path = path !== undefined ? path : ''
  const baseURL = process?.env?.NEXT_PUBLIC_API_URL
  const baseWithPath = `${baseURL}${path}`
  return baseWithPath
}

/*const readPublicFileBuffer = async (filename: string) => {
  const publicDirectory = path.join(process.cwd(), '/public')
  const fileContents = await fs.readFile(publicDirectory + filename)
  return fileContents
}

const getFontBuffer = async (name: string) => {
  const fontPath = `/fonts/${name}`
  return await readPublicFileBuffer(fontPath)
}*/

const renderOG = async (
  org_name: string,
  repository: RepositoryPublicRead | undefined,
  issue_count: number,
  avatar: string,
  issues: IssuePublicRead[],
  largeIssue: boolean,
) => {
  // const interRegular = await getFontBuffer('Inter-Regular.ttf')
  // const interMedium = await getFontBuffer('Inter-Medium.ttf')

  return new ImageResponse(
    (
      <OpenGraphImage
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
      /*fonts: [
        {
          name: 'Inter',
          data: interRegular,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: interMedium,
          weight: 500,
          style: 'medium',
        },
      ],*/
    },
  )
}

const getData = async (
  org: string,
  repo: string | null,
): Promise<OrganizationPublicPageRead> => {
  const params = new URLSearchParams()
  if (repo) {
    params.set('repo_name', repo)
  }
  return await fetch(
    `${getServerURL()}/api/v1/github/${org}/public?${params.toString()}`,
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

import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  try {
    const org = searchParams.get('org')
    if (!org) {
      throw new Error('no org')
    }

    const repo = searchParams.get('repo')
    const number = searchParams.get('number')

    const data = await getData(org, repo)

    let largeIssue = false

    if (number) {
      const singleIssue = data.issues.find((i) => i.number)
      if (singleIssue) {
        data.issues = [singleIssue]
        largeIssue = true
      }
    }

    return await renderOG(
      data.organization.name,
      data.repositories.find((r) => r.name === repo),
      data.total_issue_count,
      data.organization.avatar_url,
      data.issues,
      largeIssue,
    )
  } catch (error) {
    console.log(error)
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}
