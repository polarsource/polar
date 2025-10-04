import { CustomersPage } from '@/components/Landing/features/CustomersPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customer Management — Polar',
  description:
    'Streamlined customer lifecycle management with detailed profiles, subscription management, and customer analytics.',
  keywords:
    'customer management, customer portal, subscription management, customer analytics, saas customers',
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
  return <CustomersPage />
}
