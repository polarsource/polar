import { StartupProgramPage } from '@/components/Landing/startup-program/StartupProgramPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polar Startup Program',
  description:
    'Scale-tier pricing for a full year, free. For AI and SaaS startups building on Polar.',
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
  return <StartupProgramPage />
}
