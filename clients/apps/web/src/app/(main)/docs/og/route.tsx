import LogoIcon from '@/components/Brand/LogoIcon'
import { notFound } from 'next/navigation'
import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const [interRegular, interMedium] = await Promise.all([
    fetch(
      `${process.env.NEXT_PUBLIC_FRONTEND_BASE_URL}/fonts/Inter-Regular.ttf`,
    ).then((res) => res.arrayBuffer()),
    fetch(
      `${process.env.NEXT_PUBLIC_FRONTEND_BASE_URL}/fonts/Inter-Medium.ttf`,
    ).then((res) => res.arrayBuffer()),
  ])

  try {
    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title')
    const description = searchParams.get('description')

    const imageBaseURL = `${process.env.NEXT_PUBLIC_FRONTEND_BASE_URL}/assets/docs/og`

    // Generate OG image
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '80px',
            position: 'relative',
            backgroundColor: '#000000',
            backgroundImage: `url(${imageBaseURL}/bg.jpg)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            fontFamily: 'Inter, Helvetica, Arial, sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              top: 80,
              left: 80,
              color: '#ffffff',
            }}
          >
            <LogoIcon size={60} />
          </div>
          <div
            style={{
              color: '#ffffff',
              fontSize: '60px',
              fontWeight: 600,
              marginBottom: '20px',
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '32px',
                marginTop: '20px',
                lineHeight: 1.4,
              }}
            >
              {description}
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Inter',
            data: interMedium,
            weight: 600,
            style: 'normal',
          },
          {
            name: 'Inter',
            data: interRegular,
            weight: 500,
            style: 'normal',
          },
        ],
      },
    )
  } catch (error) {
    console.error('Error generating OG image:', error)
    return notFound()
  }
}
