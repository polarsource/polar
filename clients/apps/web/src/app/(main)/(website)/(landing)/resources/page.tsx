import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Handy links related to the Polar platform',
  keywords:
    'monetization, merchant of record, saas, digital products, platform, developer, open source, funding, open source, economy',
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
    title: 'Documentation',
    description: 'Learn the ins and outs of the Polar platform',
    href: 'https://polar.sh/docs',
    target: '_blank',
  },
  {
    title: 'Why Polar',
    description:
      'Learn why Polar is the best choice for monetizing your business',
    href: '/resources/why',
  },
  {
    title: 'Pricing',
    href: '/resources/pricing',
    description: 'The cheapest & most transparent Merchant of Record',
  },
  {
    title: 'Merchant of Record',
    href: '/resources/merchant-of-record',
    description: 'Learn the differences between PSPs and Merchant of Records',
  },
]

const comparisonLinks = [
  {
    title: 'Polar vs. Stripe',
    href: '/resources/comparison/stripe',
    description: 'Compare Polar with Stripe',
    target: '_blank',
  },

  {
    title: 'Polar vs. Paddle',
    href: '/resources/comparison/paddle',
    description: 'Compare Polar with Paddle',
    target: '_blank',
  },
  {
    title: 'Polar vs. Lemon Squeezy',
    href: '/resources/comparison/lemon-squeezy',
    description: 'Compare Polar with Lemon Squeezy',
    target: '_blank',
  },
]
export default function Resources() {
  return (
    <div className="mx-auto flex h-full min-h-screen w-full max-w-6xl flex-col gap-y-8 md:gap-y-16">
      <div className="flex flex-col gap-y-8">
        <h3 className="text-3xl md:text-5xl">Resources</h3>
      </div>
      <div className="flex flex-col gap-y-8">
        <h3 className="text-2xl">Platform</h3>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {resourceLinks.map((link) => (
            <Link
              key={link.title + link.description}
              className="dark:hover:bg-polar-900 dark:border-polar-700 flex w-full cursor-pointer flex-col gap-6 border border-gray-300 p-6 transition-colors duration-200 hover:bg-gray-100"
              href={link.href}
              target={link.target}
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
      <div className="flex flex-col gap-y-8">
        <h3 className="text-2xl">Comparisons</h3>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {comparisonLinks.map((link) => (
            <Link
              key={link.title + link.description}
              className="dark:hover:bg-polar-900 dark:border-polar-700 flex w-full cursor-pointer flex-col gap-6 border border-gray-300 p-6 transition-colors duration-200 hover:bg-gray-100"
              href={link.href}
              target={link.target}
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
