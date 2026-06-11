import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { OrbitingSpheres } from '@/components/OrbitingSpheres'
import { componentItems, foundationItems } from '@/lib/registry'

const PRINCIPLES = [
  {
    title: 'Design by subtraction',
    body: 'Start with everything. Remove until only what is necessary remains. Then remove one more thing. What survives is the design.',
  },
  {
    title: 'Derived, not decorated',
    body: 'Every element should feel like it emerged from an underlying rule, not a preference. Beauty is an outcome of correctness, not ornament.',
  },
  {
    title: 'Precision as respect',
    body: 'An imprecise pixel, word, or interaction signals that we do not understand the people we build for. Precision is not a quality bar, it is a form of respect.',
  },
]

function TextLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Box
        alignItems="center"
        columnGap="xs"
        color={{ base: 'text-secondary', hover: 'text-primary' }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        <Text color="inherit">{label}</Text>
        <ArrowRight size={15} aria-hidden />
      </Box>
    </Link>
  )
}

function LinkCard({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Box
        flexDirection="column"
        rowGap="xs"
        height="100%"
        padding="l"
        borderRadius="m"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor={{
          base: 'background-card',
          hover: 'background-secondary',
        }}
        transform={{ hover: 'translateY(-2px)' }}
        transitionProperty="common"
        transitionDuration="fast"
        ease="decelerate"
        cursor="pointer"
      >
        <Text variant="heading-xxs" as="h3">
          {title}
        </Text>
        <Text variant="caption" color="muted">
          {description}
        </Text>
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
      <Box
        display="grid"
        gridTemplateColumns={{
          base: '1fr',
          sm: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
        }}
        gap="m"
      >
        {items.map((item) => (
          <LinkCard key={item.href} {...item} />
        ))}
      </Box>
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
          <Text variant="heading-xl" as="h1">
            Orbit
          </Text>
        </Box>
        <Box maxWidth={560}>
          <Text variant="body">
            The foundation behind every Polar surface. A set of design tokens
            and composable primitives, built so the interface is derived from
            rules rather than assembled by hand.
          </Text>
        </Box>
      </Box>

      <Box as="section" flexDirection="column" rowGap="l">
        <Box flexDirection="column" rowGap="s" maxWidth={620}>
          <Text variant="heading-xs" as="h2">
            Principles
          </Text>
          <Text variant="body" color="muted">
            Three rules govern every decision in the system. They are why Orbit
            looks the way it does, and the bar each component is held to.
          </Text>
        </Box>
        <Box
          display="grid"
          gridTemplateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
          gap="m"
        >
          {PRINCIPLES.map((principle) => (
            <Box
              key={principle.title}
              flexDirection="column"
              rowGap="m"
              height="100%"
              padding="xl"
              borderRadius="l"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              backgroundColor="background-card"
            >
              <Text variant="heading-xxs" as="h3">
                {principle.title}
              </Text>
              <Text variant="default" color="muted">
                {principle.body}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Catalog title="Foundations" items={foundationItems} />
      <Catalog title="Components" items={componentItems} />
    </Box>
  )
}
