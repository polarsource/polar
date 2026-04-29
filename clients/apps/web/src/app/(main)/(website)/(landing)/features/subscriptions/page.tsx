import { SubscriptionsPage } from '@/components/Landing/features/SubscriptionsPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Subscriptions — Polar',
  description:
    'Recurring revenue on autopilot. Renewals, proration, dunning, and customer self-service — all handled.',
  keywords:
    'subscriptions, recurring billing, saas billing, proration, dunning, renewal, customer portal',
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
  return <SubscriptionsPage />
}
