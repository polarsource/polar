import { UsageBillingPage } from '@/components/Landing/features/UsageBillingPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Usage Billing on Steroids — Polar',
  description:
    'Flexible usage-based billing that scales with your business. Track consumption, meter usage, and bill customers accurately.',
  keywords:
    'usage billing, metered billing, consumption billing, pay-as-you-go, usage tracking, saas billing',
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
  return <UsageBillingPage />
}
