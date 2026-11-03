import { BrandPage } from '@/components/Brand/BrandPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brand',
  alternates: {
    canonical: 'https://polar.sh/brand',
  },
  description:
    'The Polar brand system: logo, color, typography, illustration, voice and marketing.',
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
  return <BrandPage />
}
