import { Metadata } from 'next'
import LandingPage from '../../../../components/Landing/LandingPage'

export const metadata: Metadata = {
  title: 'Spaire — The Global Revenue Layer for B2B SaaS',
  description:
    'Spaire is the financial and legal infrastructure that helps SaaS companies sell software globally in 135+ countries, without the compliance headache.',
  keywords:
    'merchant of record, b2b saas, global billing, saas payments, tax compliance, revenue infrastructure, subscriptions, usage-based billing',
  openGraph: {
    siteName: 'Spaire',
    type: 'website',
    title: 'Spaire — The Global Revenue Layer for B2B SaaS',
    description:
      'Sell SaaS globally with Spaire. We handle tax, compliance, billing, and payments so you can focus on shipping code.',
    images: [
      {
        url: 'https://spairehq.com/og.png', // update if different
        width: 1200,
        height: 630,
        alt: 'Spaire',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spaire — The Global Revenue Layer for B2B SaaS',
    description:
      'Sell SaaS globally with Spaire. Merchant of Record infrastructure for modern B2B software companies.',
    images: [
      {
        url: 'https://spairehq.com/og.png',
        width: 1200,
        height: 630,
        alt: 'Spaire',
      },
    ],
  },
}

export default function Page() {
  return <LandingPage />
}
