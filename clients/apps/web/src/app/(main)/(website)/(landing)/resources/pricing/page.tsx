import { PricingPage } from '@/components/Landing/resources/PricingPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'The cheapest MoR on the market',
  keywords:
    'pricing, price, usage billing, polar, pricing, pricing for polar, pricing for polar, pricing for polar',
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
