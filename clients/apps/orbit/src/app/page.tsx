import { Box } from '@polar-sh/orbit/Box'
import { Grid, GridItem, Text } from '@polar-sh/orbit'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { OrbitingSpheres } from '@/components/OrbitingSpheres'
import { componentItems, foundationItems } from '@/lib/registry'

const PRINCIPLES = [
  {
    title: 'Design by subtraction',
    lead: 'Start with everything. Remove until only what is necessary remains. Then remove one more thing. What survives is the design.',
    body: 'Orbit ships one spacing scale, a handful of radii, and a small set of semantic colors. The constraint is the feature. Fewer choices means fewer ways to drift, so every surface in Polar reads as one system.',
  },
  {
    title: 'Derived, not decorated',
    lead: 'Every element should feel like it emerged from an underlying rule, not a preference. Beauty is an outcome of correctness, not ornament.',
    body: 'Color resolves from light-dark(), spacing from a single scale, motion from physical curves. You author one styling pass and dark mode is free, because the values are computed rather than handpicked.',
  },
  {
    title: 'Precision as respect',
    lead: 'An imprecise pixel, word, or interaction signals that we do not understand the people we build for. Precision is not a quality bar, it is a form of respect.',
    body: 'Polar builds for a technical audience. Box makes precision the default by removing arbitrary values: typed props take tokens, never raw pixels, so the easy path and the correct path are the same.',
  },
]

function LinkCard({
  index,
  href,
  title,
  description,
}: {
  index: string
  href: string
  title: string
  description: string
}) {
  return (
    <Link href={href} className="block h-full w-full">
      <Box
        flexDirection="column"
        justifyContent="between"
        rowGap="xl"
        height="100%"
        minHeight={148}
        padding="xl"
        opacity={{
          base: 1,
          hover: 0.8,
        }}
        backgroundColor="background-card"
        transitionProperty="common"
        transitionDuration="fast"
        ease="decelerate"
        cursor="pointer"
      >
        <Box alignItems="center" justifyContent="between">
          <Text variant="mono" color="muted">
            {index}
          </Text>
          <Box
            color={{ base: 'text-tertiary', hover: 'text-primary' }}
            transform={{ hover: 'translate(3px, -3px)' }}
            transitionProperty="common"
            transitionDuration="fast"
            ease="decelerate"
          >
            <ArrowUpRight size={18} aria-hidden />
          </Box>
        </Box>
        <Box flexDirection="column" rowGap="s">
          <Text variant="heading-xxs" as="h3">
            {title}
          </Text>
          <Text variant="body" color="muted">
            {description}
          </Text>
        </Box>
      </Box>
    </Link>
  )
}

function Catalog({
  title,
  items,
}: {
  title: string
  items: typeof foundationItems
}) {
  return (
    <Box as="section" flexDirection="column" rowGap="l">
      <Text variant="heading-xs" as="h2">
        {title}
      </Text>
      <Grid
        templateColumns={{
          base: '1fr',
          sm: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
        }}
        gap="l"
      >
        {items.map((item, i) => (
          <GridItem key={item.href}>
            <LinkCard index={String(i + 1).padStart(2, '0')} {...item} />
          </GridItem>
        ))}
      </Grid>
    </Box>
  )
}

export default function HomePage() {
  return (
    <Box flexDirection="column" rowGap="5xl">
      <Box
        as="section"
        flexDirection="column"
        alignItems="center"
        textAlign="center"
        rowGap="xl"
        paddingTop="xl"
      >
        <Box width="100%" maxWidth={300} aspectRatio="1 / 1">
          <OrbitingSpheres />
        </Box>
        <Box flexDirection="column" alignItems="center" rowGap="xs">
          <Text variant="heading-l" as="h1">
            Orbit
          </Text>
        </Box>
        <Box maxWidth={560}>
          <Text variant="heading-xxs">
            The foundation behind every Polar surface
          </Text>
        </Box>
      </Box>

      <Box as="section" flexDirection="column">
        <Box flexDirection="column" rowGap="s" paddingBottom="xl">
          <Text variant="heading-xs" as="h2">
            Principles
          </Text>
          <Text variant="heading-xxs" color="muted">
            Three rules govern every decision in the system. They are why Orbit
            looks the way it does, and the bar each component is held to.
          </Text>
        </Box>

        {PRINCIPLES.map((principle, i) => (
          <Grid
            key={principle.title}
            templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
            gap={{ base: 'l', md: '3xl' }}
            paddingVertical="3xl"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <GridItem>
              <Box flexDirection="column" rowGap="m">
                <Text variant="mono" color="muted">
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Text variant="heading-s" as="h3">
                  {principle.title}
                </Text>
              </Box>
            </GridItem>
            <GridItem colSpan={{ base: 1, md: 2 }}>
              <Box flexDirection="column" rowGap="l" maxWidth={640}>
                <Text variant="heading-xxs" color="default" wrap="balance">
                  {principle.lead}
                </Text>
                <Text variant="body" color="muted">
                  {principle.body}
                </Text>
              </Box>
            </GridItem>
          </Grid>
        ))}
      </Box>

      <Catalog title="Foundations" items={foundationItems} />
      <Catalog title="Components" items={componentItems} />
    </Box>
  )
}
