import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { type ReactNode } from 'react'

// Small visible swatch used inside layout demos so flex/grid behavior is legible.
function Tile({ children }: { children: ReactNode }) {
  return (
    <Box
      alignItems="center"
      justifyContent="center"
      paddingVertical="m"
      paddingHorizontal="l"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-secondary"
    >
      <Text variant="label" color="default">
        {children}
      </Text>
    </Box>
  )
}

export function StackDemo() {
  return (
    <Box flexDirection="column" rowGap="m" width="100%" maxWidth={280}>
      <Tile>First</Tile>
      <Tile>Second</Tile>
      <Tile>Third</Tile>
    </Box>
  )
}

export function RowDemo() {
  return (
    <Box alignItems="center" columnGap="m">
      <Tile>One</Tile>
      <Tile>Two</Tile>
      <Tile>Three</Tile>
    </Box>
  )
}

export function CardDemo() {
  return (
    <Box
      borderRadius="l"
      backgroundColor="background-card"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      padding="xl"
      flexDirection="column"
      rowGap="m"
      maxWidth={320}
    >
      <Text variant="heading-xxs" as="h4">
        Card surface
      </Text>
      <Text color="default">
        Radius, background, border and padding composed from tokens.
      </Text>
    </Box>
  )
}

export function PolymorphismDemo() {
  return (
    <Box flexDirection="column" rowGap="m" width="100%" maxWidth={320}>
      <Box as="nav" alignItems="center" columnGap="m">
        <Text variant="label">Home</Text>
        <Text variant="label" color="default">
          Docs
        </Text>
        <Text variant="label" color="default">
          Pricing
        </Text>
      </Box>
      <Box as="ul" flexDirection="column" rowGap="s">
        <Box as="li">
          <Text color="default">List item rendered as li</Text>
        </Box>
        <Box as="li">
          <Text color="default">Keeps native list-item display</Text>
        </Box>
      </Box>
    </Box>
  )
}

export function InteractiveDemo() {
  return (
    <Box
      borderRadius="l"
      backgroundColor={{
        base: 'background-card',
        hover: 'background-secondary',
      }}
      boxShadow={{ base: 's', hover: 'm' }}
      transform={{ hover: 'translateY(-2px)' }}
      transitionProperty="common"
      transitionDuration="fast"
      ease="decelerate"
      cursor={{ hover: 'pointer' }}
      padding="xl"
      flexDirection="column"
      rowGap="xs"
      maxWidth={320}
    >
      <Text variant="heading-xxs" as="h4">
        Hover me
      </Text>
      <Text color="default">
        Pseudo-state props animate background, shadow and transform.
      </Text>
    </Box>
  )
}
