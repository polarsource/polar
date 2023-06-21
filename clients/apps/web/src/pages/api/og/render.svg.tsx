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
  const interMedium = await getFontBuffer('Inter-Medium.ttf')

  const svg = await satori(
    <div
      style={{
        height: 630,
        width: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background:
          'linear-gradient(140.12deg, rgba(252, 240, 236, 0.8) 6.39%, rgba(254, 253, 249, 0.8) 61.9%)',
        fontFamily: 'Inter',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '50px',
          paddingBottom: '150px',
          justifyContent: 'space-between',
          height: '100%',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <img
            src={avatar}
            style={{
              height: 48,
              width: 48,
              borderRadius: 48,
            }}
          />
          <div
            style={{
              fontSize: '42px',
              fontWeight: 'bold',
              color: '#181A1F',
            }}
          >
            Pydantic
          </div>
          <div
            style={{
              fontSize: '42px',
              color: '#727374',
            }}
          >
            seeks backing for 24 issues
          </div>
        </div>

        {[1, 2].map((k) => (
          <div
            key={k}
            style={{
              background: 'white',
              width: '1080px',
              height: '131px',
              display: 'flex',
              borderRadius: '24px',
              flexDirection: 'row',
              padding: '30px 38px',
              boxShadow:
                '0px 1px 8px rgba(0, 0, 0, 0.07), 0px 0.5px 2.5px rgba(0, 0, 0, 0.16)',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontSize: '30px',
                  color: '#181A1F',
                }}
              >
                Wrong handling of 0 in expires_atz
              </div>
              <div
                style={{
                  fontSize: '26px',
                  color: '#727374',
                }}
              >
                #8130 opened 21 days ago
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '24px',
                gap: '20px',
                color: '#808080',
              }}
            >
              <div>👍 21</div>
              <div
                style={{
                  background: '#4667CA',
                  color: 'white',
                  fontSize: '24px',
                  padding: '18px 28px',
                  borderRadius: '8px',
                }}
              >
                Pledge
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background:
            'linear-gradient(180deg, rgba(254, 253, 249, 0) 0%, #FEFDF9 56.95%)',
          height: '300px',
          width: '100%',
          position: 'absolute',
          top: '305px',
        }}
      ></div>

      <img
        style={{
          height: '50px',
          position: 'absolute',
          bottom: '50px',
        }}
        src="http://127.0.0.1:3000/og_logotype.png"
      />
    </div>,
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
