import { PolarVsLemonSqueezyPage } from '@/components/Landing/resources/PolarVsLemonSqueezyPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polar vs LemonSqueezy - Comprehensive Comparison | Polar',
  description: 'Compare Polar vs LemonSqueezy: pricing, features, developer experience, and migration guide. Discover why Polar is 20% cheaper and more developer-friendly.',
  keywords: [
    'polar vs lemonsqueezy',
    'lemonsqueezy alternative',
    'merchant of record comparison',
    'digital product sales platform',
    'polar lemonsqueezy pricing',
    'cheapest merchant of record',
    'mor platform comparison',
    'developer payment platform',
    'digital product monetization',
    'subscription billing comparison',
    'polar pricing vs lemonsqueezy',
    'payment infrastructure comparison'
  ].join(', '),
  openGraph: {
    title: 'Polar vs LemonSqueezy - Why Developers Choose Polar',
    description: 'Polar offers 20% lower fees (4% vs 5%+), better developer experience, and more flexibility than LemonSqueezy. Compare features, pricing, and migration guide.',
    siteName: 'Polar',
    type: 'article',
    url: 'https://polar.sh/resources/polar-vs-lemonsqueezy',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
        alt: 'Polar vs LemonSqueezy Comparison',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polar vs LemonSqueezy - Developer-First MoR Platform',
    description: 'See why developers choose Polar over LemonSqueezy: 4% fees vs 5%+, better APIs, open source, and superior developer experience.',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
        alt: 'Polar vs LemonSqueezy',
      },
    ],
  },
  alternates: {
    canonical: 'https://polar.sh/resources/polar-vs-lemonsqueezy',
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
  return <PolarVsLemonSqueezyPage />
}