import OpenGraphImage from '@/components/Organization/OpenGraphImage'
import { promises as fs } from 'fs'
import { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import { api } from 'polarkit'
import {
  IssuePublicRead,
  OrganizationPublicPageRead,
  Platforms,
} from 'polarkit/api/client'
const { default: satori } = require('satori')

const readPublicFileBuffer = async (filename: string) => {
  const publicDirectory = path.join(process.cwd(), '/public')
  const fileContents = await fs.readFile(publicDirectory + filename)
  return fileContents
}

const getFontBuffer = async (name: string) => {
  const fontPath = `/fonts/${name}`
  return await readPublicFileBuffer(fontPath)
}

export const renderOG = async (
  org_name: string,
  issue_count: number,
  avatar: string,
  issues: IssuePublicRead[],
) => {
  const interRegular = await getFontBuffer('Inter-Regular.ttf')
  const interMedium = await getFontBuffer('Inter-Medium.ttf')

  const svg = await satori(
    <OpenGraphImage
      org_name={org_name}
      issue_count={issue_count}
      avatar={avatar}
      issues={issues}
    />,
    {
      height: 630,
      width: 1200,
      fonts: [
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
      ],
    },
  )

  return svg
}

const getData = async (
  org: string,
  repo: string,
): Promise<OrganizationPublicPageRead> => {
  const res = await api.organizations.getPublicIssues({
    platform: Platforms.GITHUB,
    orgName: org,
  })
  return res
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const data = await getData('zegloforko', '')

  console.log(data.total_issue_count)

  try {
    const svg = await renderOG(
      data.organization.name,
      data.total_issue_count,
      data.organization.avatar_url,
      data.issues,
    )
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'no-cache')
    res.end(svg)
  } catch (error) {
    console.log({ error })
    // Return 1x1 pixel SVG to prevent image-not-found issues in browsers
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'no-cache')
    res.status(400)
    res.end(
      '<svg width="1" height="1" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg"></svg>',
    )
  }
}
