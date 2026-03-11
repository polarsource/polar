import LogoType from '@/components/Brand/logos/LogoType'
import { ImageResponse } from 'next/og'

export const runtime = 'edge'

async function loadGoogleFont(font: string) {
  const url = `https://fonts.googleapis.com/css2?family=${font.replaceAll(' ', '+')}`
  const css = await (await fetch(url)).text()
  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

  if (resource) {
    const response = await fetch(resource[1])
    if (response.status == 200) {
      return await response.arrayBuffer()
    }
  }

  throw new Error('failed to load font data ')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const title = searchParams.has('title')
    ? searchParams.get('title')?.slice(0, 100)
    : 'Polar'

  const description = searchParams.has('description')
    ? searchParams.get('description')?.slice(0, 160)
    : null

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        backgroundColor: '#09090b',
        padding: '80px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Logo */}
      <div
        className="flex text-white"
        style={{
          display: 'flex',
          color: '#fff',
        }}
      >
        <LogoType width={200} />
      </div>

      {/* Main copy */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
        <div
          style={{
            fontSize: '92px',
            fontWeight: '600',
            color: 'white',
            lineHeight: 1.1,
            letterSpacing: '-2px',
            maxWidth: '900px',
            fontFamily: 'Inter',
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: '48px',
              color: '#71717a',
              maxWidth: '800px',
              lineHeight: 1.4,
              fontFamily: 'Inter',
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: await loadGoogleFont('Inter'),
          style: 'normal',
        },
      ],
    },
  )
}
