import { ProductsPage } from '@/components/Landing/features/ProductsPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Subscription billing for SaaS — Polar',
  description:
    'Flexible subscription billing with multiple pricing models, trial periods, and seamless plan management.',
  keywords:
    'subscription billing, recurring payments, saas subscriptions, pricing tiers, billing management',
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
  return <ProductsPage />
}
