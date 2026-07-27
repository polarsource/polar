import { PropsWithChildren } from 'react'
import LandingLayout from '../../../../components/Landing/LandingLayout'

export const dynamic = 'force-static'
export const dynamicParams = false

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://polar.sh/#organization',
      name: 'Polar',
      url: 'https://polar.sh/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://polar.sh/assets/brand/app-icon.png',
      },
      description:
        'Polar is an open source, developer-first monetization platform and Merchant of Record for software companies — handling payments, subscriptions, usage-based billing, and global tax compliance.',
      sameAs: ['https://github.com/polarsource', 'https://x.com/polar_sh'],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://polar.sh/#website',
      name: 'Polar',
      url: 'https://polar.sh/',
      publisher: {
        '@id': 'https://polar.sh/#organization',
      },
    },
  ],
}

export default function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <LandingLayout>{children}</LandingLayout>
    </>
  )
}
