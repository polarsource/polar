import { WhyPolarPage } from '@/components/Landing/resources/WhyPolarPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Why Polar is the best way to monetize your software',
  description: 'Learn why Polar is the best way to monetize your software',
  keywords:
    'monetize, monetization, switch, migration, payment infrastructure, saas, monetization, developer tools',
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
  return <WhyPolarPage />
}
