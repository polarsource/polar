import { MetersPage } from '@/components/Landing/features/MetersPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Meters',
  description:
    'Turn raw usage events into a number per customer. Filter the stream, pick an aggregation and price the result for tokens, API calls and compute.',
  keywords:
    'usage meters, metered billing, aggregation, token billing, usage billing, ai billing',
  openGraph: {
    siteName: 'Polar',
    type: 'website',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
        alt: 'Polar',
      },
    ],
  },
}

export default function Page() {
  return <MetersPage />
}
