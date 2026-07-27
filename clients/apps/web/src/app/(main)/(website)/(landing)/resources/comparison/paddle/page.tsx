import { PolarVsPaddlePage } from '@/components/Landing/comparison/PolarPaddlePage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polar vs Paddle',
  description:
    'Polar vs Paddle: compare two Merchant of Record platforms for SaaS and digital products, including billing models, usage-based pricing and transaction fees.',
  keywords:
    'polar vs paddle, paddle alternative, merchant of record, saas billing, subscriptions, usage-based billing',
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
