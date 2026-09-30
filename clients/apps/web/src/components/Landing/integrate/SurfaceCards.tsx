import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { Compass } from '../graphics/Compass'
import { Dumbbell } from '../graphics/Dumbbell'
import { LinkedRings } from '../graphics/LinkedRings'

interface Surface {
  title: string
  desc: string
  href: string
  Graphic: ComponentType
}

const SURFACES: Surface[] = [
  {
    title: 'MCP',
    desc: 'Your agent reads and acts on your billing.',
    href: '#mcp',
    Graphic: Compass,
  },
  {
    title: 'SDK',
    desc: 'Typed clients for TypeScript and Python.',
    href: '#sdk',
    Graphic: LinkedRings,
  },
  {
    title: 'CLI',
    desc: 'Webhooks on localhost, events on demand.',
    href: '#cli',
    Graphic: Dumbbell,
  },
]

export const SurfaceCards = () => (
  <Grid
    templateColumns={{
      base: '1fr',
      md: 'repeat(2, 1fr)',
      xl: 'repeat(3, 1fr)',
    }}
    gap="l"
  >
    {SURFACES.map(({ title, desc, href, Graphic }) => (
      <Link key={title} href={href}>
        <Box
          height="100%"
          flexDirection="column"
          justifyContent="between"
          rowGap="3xl"
          padding={{ base: 'xl', md: '2xl' }}
          backgroundColor={{
            base: 'background-secondary',
            hover: 'background-card',
          }}
          transitionProperty="colors"
          transitionDuration="fast"
        >
          <Box display="block" aspectRatio="1 / 1">
            <Graphic />
          </Box>
          <Box flexDirection="column" rowGap="s">
            <Text variant="heading-xs" as="h3">
              {title}
            </Text>
            <Text variant="heading-xxs" color="muted" wrap="pretty">
              {desc}
            </Text>
          </Box>
        </Box>
      </Link>
    ))}
  </Grid>
)
