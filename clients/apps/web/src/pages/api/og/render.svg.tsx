import { promises as fs } from 'fs'
import { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import { GithubBadgeRead } from 'polarkit/api/client'
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

export const renderOG = async (title: string, avatar: string) => {
  const interRegular = await getFontBuffer('Inter-Regular.ttf')
  const svg = await satori(
    <div
      style={{
        display: 'flex',
        paddingBottom: 2,
      }}
    >
      <div
        style={{
          height: 630,
          width: 1200,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'pink',
          borderRadius: 11,
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.11)',
          fontFamily: 'Inter',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '40px',
          }}
        >
          {title}
        </div>
        <img
          src={avatar}
          style={{
            height: 100,
            width: 100,
            borderRadius: 50,
          }}
        />
      </div>
    </div>,
    {
      height: 630,
      width: 1200,
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
  const isDarkmode = req.query?.darkmode ? true : false
  const amount =
    typeof req.query?.amount === 'string' ? parseInt(req.query?.amount) : 0

  const badge: GithubBadgeRead = {
    badge_type: GithubBadgeRead.badge_type.PLEDGE,
    amount,
  }

  try {
    const svg = await renderOG(
      'zegl/kube-score have 27 issues looking for funding',
      'https://avatars.githubusercontent.com/u/47952?v=4',
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
