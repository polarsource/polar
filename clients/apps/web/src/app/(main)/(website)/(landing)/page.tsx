import { Metadata } from 'next'
import LandingPage from '../../../../components/Landing/LandingPage'
export const metadata: Metadata = {
  title: 'Polar — A billing platform for the intelligence era',
  description:
    'Polar is the Merchant of Record for developers building AI-era software: payments, subscriptions, and usage-based billing, with global tax handled for you.',
  keywords:
    'monetization, merchant of record, saas, digital products, platform, developer, open source, funding, open source, economy',
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
  return <LandingPage />
}
