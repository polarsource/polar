import { PricingPage } from '@/components/Landing/resources/PricingPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Transparent pricing for every stage of growth',
  keywords:
    'polar pricing, merchant of record fees, usage-based billing pricing, saas billing costs, transaction fees',
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
  return <PricingPage />
}
