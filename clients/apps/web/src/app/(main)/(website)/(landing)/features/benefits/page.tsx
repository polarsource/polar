import { BenefitsPage } from '@/components/Landing/features/BenefitsPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Product benefits & fulfillment — Polar',
  description:
    'Automate product benefits with license keys, file downloads, GitHub access, Discord roles, and custom integrations.',
  keywords:
    'product benefits, license keys, digital downloads, github access, discord integration, benefit fulfillment',
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
  return <BenefitsPage />
}
