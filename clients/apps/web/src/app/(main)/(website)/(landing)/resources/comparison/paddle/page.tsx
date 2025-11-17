import { PolarVsPaddlePage } from '@/components/Landing/comparison/PolarPaddlePage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polar vs Paddle',
  description: 'Comparing Polar and Paddle',
  keywords:
    'polar vs paddle, paddle, polar, comparison, pricing, pricing for polar, pricing for polar, pricing for polar',
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
  return <PolarVsPaddlePage />
}
