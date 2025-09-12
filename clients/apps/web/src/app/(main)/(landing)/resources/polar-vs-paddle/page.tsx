import { PolarVsPaddlePage } from '@/components/Landing/resources/PolarVsPaddlePage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polar vs Paddle - Comprehensive Comparison | Polar',
  description:
    'Compare Polar vs Paddle: pricing, features, developer experience, and migration guide. Discover why Polar is 20% cheaper and more developer-friendly.',
  keywords: [
    'polar vs paddle',
    'paddle alternative',
    'merchant of record comparison',
    'digital product sales platform',
    'polar paddle pricing',
    'cheapest merchant of record',
    'mor platform comparison',
    'developer payment platform',
    'digital product monetization',
    'subscription billing comparison',
    'polar pricing vs paddle',
    'payment infrastructure comparison',
  ].join(', '),
  openGraph: {
    title: 'Polar vs Paddle - Why Developers Choose Polar',
    description:
      'Polar offers 20% lower fees (4% vs 5%+), better developer experience, and more flexibility than Paddle. Compare features, pricing, and migration guide.',
    siteName: 'Polar',
    type: 'article',
    url: 'https://polar.sh/resources/polar-vs-paddle',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
        alt: 'Polar vs Paddle Comparison',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polar vs Paddle - Developer-First MoR Platform',
    description:
      'See why developers choose Polar over Paddle: 4% fees vs 5%+, better APIs, open source, and superior developer experience.',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
        alt: 'Polar vs Paddle',
      },
    ],
  },
  alternates: {
    canonical: 'https://polar.sh/resources/polar-vs-paddle',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'Technology',
}

export default function Page() {
  return <PolarVsPaddlePage />
}
