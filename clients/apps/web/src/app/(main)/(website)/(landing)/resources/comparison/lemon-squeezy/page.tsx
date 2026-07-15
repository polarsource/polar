import { PolarVsLemonSqueezyPage } from '@/components/Landing/comparison/PolarLemonSqueezyPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polar vs Lemon Squeezy',
  description:
    'Polar vs Lemon Squeezy: compare two Merchant of Record platforms for developers, including open-source billing, usage-based pricing and transaction fees.',
  keywords:
    'polar vs lemon squeezy, lemon squeezy alternative, merchant of record, saas billing, digital products',
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
  return <PolarVsLemonSqueezyPage />
}
