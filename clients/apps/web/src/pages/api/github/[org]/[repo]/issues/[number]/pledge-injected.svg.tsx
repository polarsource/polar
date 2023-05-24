import { NextApiRequest, NextApiResponse } from 'next'
import { GithubBadgeRead } from 'polarkit/api/client'
import { renderBadge } from './pledge.svg'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const isDarkmode = req.query?.darkmode ? true : false
  const amount =
    typeof req.query?.amount === 'string' ? parseInt(req.query?.amount) : 0

  const badge: GithubBadgeRead = {
    badge_type: GithubBadgeRead.badge_type.PLEDGE,
    amount,
  }

  try {
    const svg = await renderBadge(badge, isDarkmode)
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
