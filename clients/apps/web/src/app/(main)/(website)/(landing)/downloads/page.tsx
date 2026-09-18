import { StaticImage } from '@/components/Image/StaticImage'
import { Chapter } from '@/components/Landing/Chapter'
import { Apple, Framer, Google, Raycast } from '@/components/Landing/Logos'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Downloads',
  description: 'Use Polar in a variety of different environments',
  keywords:
    'downloads, ios, android, raycast, framer, binaries, saas, digital products, platform, developer, open source, funding, open source, economy',
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

interface Download {
  title: string
  description: string
  href: string
  icon: ReactNode
}

const APPS: Download[] = [
  {
    title: 'Polar for iOS',
    description: 'Your business in the palm of your hand. Built for iPhone.',
    href: 'https://apps.apple.com/se/app/polar-monetize-your-software/id6746640471',
    icon: <Apple size={28} />,
  },
  {
    title: 'Polar for Android',
    description:
      'The companion app for your business on Polar. Built for Android.',
    href: 'https://play.google.com/store/apps/details?id=com.polarsource.Polar',
    icon: <Google size={28} />,
  },
]

const PLUGINS: Download[] = [
  {
    title: 'Polar for Raycast',
    description: 'Your latest orders and customers right at your fingertips.',
    href: 'https://www.raycast.com/emilwidlund/polar',
    icon: <Raycast size={28} />,
  },
  {
    title: 'Polar for Framer',
    description: 'Flexible checkout components for your Framer projects.',
    href: 'https://www.framer.com/marketplace/plugins/polar',
    icon: <Framer size={28} />,
  },
]

const DownloadCard = ({ title, description, href, icon }: Download) => (
  <Link href={href} target="_blank" rel="noopener noreferrer">
    <Box
      height="100%"
      flexDirection="column"
      justifyContent="between"
      rowGap="4xl"
      padding={{ base: 'xl', md: '3xl' }}
      backgroundColor={{
        base: 'background-secondary',
        hover: 'background-card',
      }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <Box>{icon}</Box>
      <Box flexDirection="column" rowGap="s">
        <Text variant="heading-xs" as="h3">
          {title}
        </Text>
        <Text variant="heading-xxs" color="muted" wrap="pretty">
          {description}
        </Text>
      </Box>
    </Box>
  </Link>
)

const DownloadGrid = ({ items }: { items: Download[] }) => (
  <Grid
    templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
    gap={{ base: '2xl', lg: 'l' }}
  >
    <Box display={{ base: 'none', lg: 'flex' }} />
    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="l">
      {items.map((item) => (
        <DownloadCard key={item.title} {...item} />
      ))}
    </Grid>
  </Grid>
)

export default function Downloads() {
  return (
    <Box width="100%" flexDirection="column">
      <Box
        as="section"
        width="100%"
        flexDirection="column"
        paddingTop={{ base: 'm', md: '5xl' }}
        paddingBottom={{ base: '3xl', md: '5xl' }}
      >
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gap={{ base: '2xl', lg: 'l' }}
        >
          <Box flexDirection="column" rowGap="m">
            <Text variant="heading-xl" as="h1" wrap="balance">
              Polar in your pocket
            </Text>
            <Text variant="heading-xl" as="p" color="muted" wrap="balance">
              Apps and plugins for every platform
            </Text>
          </Box>
          <Box position="relative" overflow="hidden" aspectRatio="3 / 2">
            <StaticImage
              src="/assets/landing/company/polar.jpg"
              alt="Polar graphic"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
            />
          </Box>
        </Grid>
      </Box>

      <Chapter
        name="Mobile apps"
        title="Your business in the palm of your hand"
        subtitle="Built for iPhone and Android"
      >
        <DownloadGrid items={APPS} />
      </Chapter>

      <Chapter
        name="Plugins"
        title="Polar in your favourite tools"
        subtitle="Raycast and Framer"
      >
        <DownloadGrid items={PLUGINS} />
      </Chapter>
    </Box>
  )
}
