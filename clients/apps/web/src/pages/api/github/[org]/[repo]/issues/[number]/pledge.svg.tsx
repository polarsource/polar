import { promises as fs } from 'fs'
import { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import { api } from 'polarkit/api'
import { GithubBadgeRead } from 'polarkit/api/client'
import { Badge } from 'polarkit/components'
import { getCentsInDollarString } from 'polarkit/utils'
const satori = require('satori')

const readPublicFileBuffer = async (filename: string) => {
  const publicDirectory = path.join(process.cwd(), '/public')
  const fileContents = await fs.readFile(publicDirectory + filename)
  return fileContents
}

const getFontBuffer = async (name: string) => {
  const fontPath = `/fonts/${name}`
  return await readPublicFileBuffer(fontPath)
}

const getBadgeData = async (
  org: string,
  repo: string,
  number: number,
): Promise<GithubBadgeRead> => {
  const res = await api.integrations.getBadgeSettings({
    org,
    repo,
    number,
    badgeType: 'pledge',
  })
  if (!res.badge_type) throw new Error('Invalid badge response')
  return res
}

const generateBadge = async (
  org: string,
  repo: string,
  number: number,
  isDarkmode: boolean,
) => {
  const badge = await getBadgeData(org, repo, number)
  let hasAmount = badge.amount !== null

  const interRegular = await getFontBuffer('Inter-Regular.ttf')

  const amountRaised = badge.amount
    ? getCentsInDollarString(badge.amount)
    : undefined

  const svg = await satori(
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
          data: interRegular,
          weight: 500,
          style: 'normal',
        },
      ],
    },
  )

  return svg
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let { org, repo, number } = req.query
  org = typeof org === 'string' ? org : ''
  repo = typeof repo === 'string' ? repo : ''
  const intNumber = typeof number === 'string' ? parseInt(number) : 0
  const isDarkmode = req.query?.darkmode ? true : false

  try {
    const svg = await generateBadge(org, repo, intNumber, isDarkmode)
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
