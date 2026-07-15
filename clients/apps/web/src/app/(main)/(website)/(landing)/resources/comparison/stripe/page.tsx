import { PolarVsStripePage } from '@/components/Landing/comparison/PolarStripePage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polar vs Stripe',
  description:
    'Polar vs Stripe: Polar is a Merchant of Record that handles payments, subscriptions, usage-based billing and global sales tax for you, while Stripe leaves tax and compliance to you.',
  keywords:
    'polar vs stripe, stripe alternative, merchant of record, saas billing, usage-based billing, payment infrastructure',
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
  return <PolarVsStripePage />
}
