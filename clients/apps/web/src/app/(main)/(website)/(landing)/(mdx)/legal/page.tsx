import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Legal',
  description: 'Legal documents',
  keywords:
    'legal, privacy, tos, terms of service, merchant of record, saas, digital products, platform, developer, open source, funding, open source, economy',
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

const resourceLinks = [
  {
    title: 'Master Services Terms',
    description: 'Core contractual terms for using Polar as a platform.',
    href: '/legal/master-services-terms',
  },
  {
    title: 'Acceptable Use Policy',
    description: 'Rules and restrictions for using Polar services.',
    href: '/legal/acceptable-use-policy',
  },
  {
    title: 'Checkout Buyer Terms',
    description: 'Terms that apply to buyers purchasing through checkout.',
    href: '/legal/checkout-buyer-terms',
  },
  {
    title: 'Data Processing Addendum',
    description: 'Data protection terms governing processing activities.',
    href: '/legal/data-processing-addendum',
  },
  {
    title: 'DPA Vendors',
    description: 'List of vendors involved in data processing activities.',
    href: '/legal/dpa-vendors',
  },
  {
    title: 'Payment Processor Partners',
    description: 'Information about payment partners used by Polar.',
    href: '/legal/payments-partners',
  },
  {
    title: 'Privacy Policy',
    description: 'How Polar collects, uses, and protects personal data.',
    href: '/legal/privacy-policy',
  },
]

export default function Legal() {
  return (
    <div className="not-prose mx-auto flex h-full min-h-screen w-full max-w-6xl flex-col gap-y-8 md:gap-y-16">
      <div className="flex flex-col gap-y-8">
        <h3 className="text-3xl md:text-5xl">Legal</h3>
      </div>
      <div className="flex flex-col gap-y-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {resourceLinks.map((link) => (
            <Link
              key={link.title + link.description}
              className="dark:hover:bg-polar-900 dark:border-polar-700 flex w-full cursor-pointer flex-col gap-6 border border-gray-300 p-6 transition-colors duration-200 hover:bg-gray-100"
              href={link.href}
            >
              <ArrowOutwardOutlined fontSize="inherit" />
              <div className="flex flex-col gap-2">
                <h3 className="font-mono text-xl">{link.title}</h3>
                <p className="dark:text-polar-500 font-sm text-gray-500">
                  {link.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
