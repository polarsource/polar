import { SeatsPage } from '@/components/Landing/features/SeatsPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Seats — Polar',
  description:
    'Pricing that scales with the team. Sell seat-based products with assignable seats, claim links, and automatic proration.',
  keywords:
    'seat-based pricing, team subscriptions, per-seat billing, volume discounts, graduated pricing',
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
  return <SeatsPage />
}
