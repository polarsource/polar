import { Metadata } from 'next'
import LandingPage from '../../../../components/Landing/LandingPage'

export const metadata: Metadata = {
  title: 'Polar — Monetize your software',
  description: 'Monetize your software with 4 lines of code',
  keywords:
    'monetization, merchant of record, saas, digital products, platform, developer, open source, funding, open source, economy, monetize your software',
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
