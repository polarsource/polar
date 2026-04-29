import { DiscountsPage } from '@/components/Landing/features/DiscountsPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Discounts — Polar',
  description:
    'Coupons, promo codes, and recurring discounts. Apply automatically at checkout, prefill via URL, or via the API.',
  keywords:
    'discounts, coupons, promo codes, percentage discount, fixed amount discount, recurring discount',
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
  return <DiscountsPage />
}
