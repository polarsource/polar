import { Box } from '@/design-system/components/Box'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polar — Monetize your software with ease',
  description: 'Monetize your software with ease',
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

export default function Page() {
  return (
    <>
      <Box
        as="section"
        padding="xl"
        borderRadius="sm"
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap="s"
        borderColor="border-primary"
        borderWidth={2}
        opacity={0.99}
        position="relative"
        top={2}
        backgroundColor={{
          sm: 'background-secondary',
          md: 'background-primary',
        }}
      >
        <p className="text-sm font-medium text-gray-900">Design System Box</p>
        <p className="text-sm font-medium text-gray-900">wow</p>
      </Box>
    </>
  )
}
