import { PropsWithChildren } from 'react'
import LandingLayout from '../../../../components/Landing/LandingLayout'

export const dynamic = 'force-static'
export const dynamicParams = false

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Polar',
  url: 'https://polar.sh/',
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
