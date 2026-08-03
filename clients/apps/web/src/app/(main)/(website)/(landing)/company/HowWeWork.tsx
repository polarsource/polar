import { SectionHeader } from '@/components/Landing/SectionHeader'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const PRINCIPLES = [
  {
    title: 'Own the outcome',
    description: 'Take problems end to end with high ownership and autonomy.',
  },
  {
    title: 'Build in the open',
    description:
      'Polar is open source. We build in public, with our community.',
  },
  {
    title: 'Obsess over developers',
    description: 'Great developer experience is the product.',
  },
  {
    title: 'Keep the team small',
    description: 'Fewer people with more ownership. Wear multiple hats.',
  },
  {
    title: 'Design by subtraction',
    description: "Say no often. Clarity comes from what's removed.",
  },
]

export const HowWeWork = () => (
  <Box as="section" flexDirection="column" rowGap="5xl">
    <SectionHeader
      title={
        <>
          Fewer people,
          <br />
          more ownership
        </>
      }
      description="Our mission is to build the finance layer for the next generation of AI products. To get there, we work by a small set of principles that keep us fast and focused."
    />
    <Box as="ul" flexDirection="column">
      {PRINCIPLES.map((principle, index) => (
        <Box
          key={principle.title}
          as="li"
          display="flex"
          flexDirection={{ base: 'column', md: 'row' }}
          rowGap="xs"
          columnGap="4xl"
          paddingVertical="xl"
          borderTopWidth={index > 0 ? 1 : 0}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <Box flex={1} alignItems="baseline" columnGap="l">
            <Text as="span" variant="heading-xxs" color="muted">
              {String(index + 1).padStart(2, '0')}
            </Text>
            <Text variant="heading-xxs" as="h3">
              {principle.title}
            </Text>
          </Box>
          <Box flex={1}>
            <Text variant="heading-xxs" color="muted">
              {principle.description}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  </Box>
)
