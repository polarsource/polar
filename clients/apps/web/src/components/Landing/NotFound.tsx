import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { WaveBars } from './graphics/WaveBars'
import { LinkedRings } from './graphics/LinkedRings'
import { SteppedRadial } from './graphics/SteppedRadial'
import { VectorField } from './graphics/VectorField'

interface Destination {
  title: string
  href: string
  Graphic: ComponentType
}

const DESTINATIONS: Destination[] = [
  { title: 'Homepage', href: '/', Graphic: SteppedRadial },
  { title: 'Blog', href: '/blog', Graphic: VectorField },
  { title: 'Documentation', href: 'https://polar.sh/docs', Graphic: WaveBars },
  { title: 'Company', href: '/company', Graphic: LinkedRings },
]

const OutwardArrow = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1}
    aria-hidden
  >
    <path d="M5.5 10.5L11 5M6 5h5v5" />
  </svg>
)

const DestinationCard = ({ title, href, Graphic }: Destination) => (
  <Link
    href={href}
    className="min-w-0"
    rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
  >
    <Box
      height="100%"
      minWidth="0"
      overflow="hidden"
      flexDirection="column"
      justifyContent="between"
      rowGap="3xl"
      padding={{ base: 'xl', md: '2xl' }}
      minHeight={{ base: '22rem', md: '26rem', lg: '0' }}
      aspectRatio={{ lg: '5 / 6' }}
      backgroundColor={{
        base: 'background-secondary',
        hover: 'background-card',
      }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <Box position="relative" flexGrow={1}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Box display="block" width="80%" aspectRatio="1 / 1">
            <Graphic />
          </Box>
        </div>
      </Box>
      <Box alignItems="center" justifyContent="between" columnGap="l">
        <Text variant="heading-xs" as="h2">
          {title}
        </Text>
        <Text variant="heading-xs">
          <OutwardArrow />
        </Text>
      </Box>
    </Box>
  </Link>
)

export const NotFound = () => {
  return (
    <Box
      as="section"
      width="100%"
      flexDirection="column"
      rowGap={{ base: '4xl', md: '5xl' }}
      paddingTop={{ base: 'm', md: '5xl' }}
      paddingBottom={{ base: '3xl', md: '5xl' }}
    >
      <Grid
        templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
        gap={{ base: '2xl', lg: 'l' }}
      >
        <Box alignItems="start" display={{ base: 'none', lg: 'flex' }}>
          <Text variant="heading-l">404</Text>
        </Box>
        <Box flexDirection="column" alignItems="start" rowGap="3xl">
          <Box flexDirection="column">
            <Text variant="heading-l" as="p" color="muted">
              Sorry
            </Text>
            <Text variant="heading-l" as="h1" wrap="balance">
              We can&apos;t find the page you&apos;re looking for.
            </Text>
          </Box>
          <Link href="/">
            <Button size="lg">Go to homepage</Button>
          </Link>
        </Box>
      </Grid>
      <Grid
        templateColumns={{
          base: '1fr',
          md: 'repeat(2, 1fr)',
          xl: 'repeat(4, 1fr)',
        }}
        gap="l"
      >
        {DESTINATIONS.map((destination) => (
          <DestinationCard key={destination.title} {...destination} />
        ))}
      </Grid>
    </Box>
  )
}
