import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { componentItems, foundationItems } from '@/lib/registry'

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

export default function HomePage() {
  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        rowGap="l"
        paddingBottom="2xl"
        marginBottom="2xl"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Text variant="heading-l" as="h1">
          Orbit
        </Text>
        <Box maxWidth={640}>
          <Text variant="body" color="muted">
            Orbit is the Polar design system. This playground documents every
            component across its variants, the design tokens that compose them,
            and the patterns for building token-driven UI with the Box
            primitive.
          </Text>
        </Box>
        <Box alignItems="center" columnGap="xs" color="text-secondary">
          <Link href="/foundations/colors" style={{ textDecoration: 'none' }}>
            <Box alignItems="center" columnGap="xs" color="text-primary">
              <Text color="inherit">Explore the foundations</Text>
              <ArrowRight size={16} />
            </Box>
          </Link>
        </Box>
      </Box>

      <Box flexDirection="column" rowGap="m" marginBottom="3xl">
        <Text variant="heading-xs" as="h2">
          Foundations
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
          {foundationItems.map((item) => (
            <LinkCard key={item.href} {...item} />
          ))}
        </Box>
      </Box>

      <Box flexDirection="column" rowGap="m">
        <Text variant="heading-xs" as="h2">
          Components
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
          {componentItems.map((item) => (
            <LinkCard key={item.href} {...item} />
          ))}
        </Box>
      </Box>
    </Box>
  )
}
