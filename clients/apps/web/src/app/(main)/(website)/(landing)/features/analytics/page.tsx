import { AnalyticsPage } from '@/components/Landing/features/AnalyticsPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics and Insights — Polar',
  description:
    'Comprehensive analytics dashboard with revenue metrics, customer insights, and growth tracking for your SaaS business.',
  keywords:
    'saas analytics, revenue metrics, customer insights, mrr tracking, saas dashboard, business analytics',
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
  return <AnalyticsPage />
}
