import { StaticImage } from '@/components/Image/StaticImage'
import { Grid } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { PropsWithChildren } from 'react'

const Tile = ({ children }: PropsWithChildren) => (
  <Box position="relative" width="100%" aspectRatio="4 / 5" overflow="hidden">
    {children}
  </Box>
)

export const HeroTiles = () => (
  <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="m">
    <Tile>
      <StaticImage
        src="/assets/landing/hero/subscriptions.jpg"
        alt="The Polar dashboard listing subscriptions, with a customer preview open"
        fill
        sizes="(min-width: 1024px) 38vw, (min-width: 768px) 50vw, 100vw"
        className="object-cover"
        priority
        unoptimized
      />
    </Tile>
    <Tile>
      <StaticImage
        src="/assets/landing/hero/cards.jpg"
        alt="Floating Polar cards labeled Usage Billing, Subscriptions, Finance and Unit Economics"
        fill
        sizes="(min-width: 1024px) 38vw, (min-width: 768px) 50vw, 100vw"
        className="object-cover"
        priority
        unoptimized
      />
    </Tile>
  </Grid>
)
