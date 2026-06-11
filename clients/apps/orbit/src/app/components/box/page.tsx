import { Text } from '@polar-sh/orbit'
import {
  Example,
  PageHeader,
  Prose,
  PropsTable,
  Section,
} from '@/components/docs'
import {
  CardDemo,
  InteractiveDemo,
  PolymorphismDemo,
  RowDemo,
  StackDemo,
} from './examples'
import { boxProps } from './props'

const stackCode = `<Box flexDirection="column" rowGap="m">
  <Tile>First</Tile>
  <Tile>Second</Tile>
  <Tile>Third</Tile>
</Box>`

const rowCode = `<Box alignItems="center" columnGap="m">
  <Tile>One</Tile>
  <Tile>Two</Tile>
  <Tile>Three</Tile>
</Box>`

const cardCode = `<Box
  borderRadius="l"
  backgroundColor="background-card"
  borderWidth={1}
  borderStyle="solid"
  borderColor="border-primary"
  padding="xl"
  flexDirection="column"
  rowGap="m"
>
  <Text variant="heading-xxs" as="h4">Card surface</Text>
  <Text color="default">Radius, background, border and padding from tokens.</Text>
</Box>`

const polymorphismCode = `<Box as="nav" alignItems="center" columnGap="m">
  <Text variant="label">Home</Text>
  <Text variant="label" color="default">Docs</Text>
</Box>

<Box as="ul" flexDirection="column" rowGap="s">
  <Box as="li">List item rendered as li</Box>
</Box>`

const interactiveCode = `<Box
  borderRadius="l"
  backgroundColor={{ base: 'background-card', hover: 'background-secondary' }}
  boxShadow={{ base: 's', hover: 'm' }}
  transform={{ hover: 'translateY(-2px)' }}
  transitionProperty="common"
  transitionDuration="fast"
  ease="decelerate"
  cursor={{ hover: 'pointer' }}
  padding="xl"
>
  …
</Box>`

export default function BoxPage() {
  return (
    <>
      <PageHeader
        title="Box"
        description="The polymorphic, token-driven layout and style primitive. Box compiles typed props into StyleX styles at build time, tokens auto-resolve light and dark mode, and display defaults to flex."
      />

      <Section
        title="Overview"
        description="Box is the canonical primitive for layout, spacing, color, borders, radius, shadow, flex, grid, position and motion."
      >
        <Prose>
          <Text variant="body" color="default">
            Every visual concern is a typed prop that accepts a design token, so
            there is no className guesswork and no dark mode boilerplate. Props
            take token names rather than raw values, and any prop also accepts a
            responsive or pseudo-state object.
          </Text>
          <Text variant="body" color="default">
            Box defaults to display flex for block-level elements, so a bare Box
            is a flex row. Set flexDirection, gap and alignment directly without
            repeating display. Inline elements and li keep their native display.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Layout"
        description="Compose flex layouts with direction, alignment and token-based gaps."
      >
        <Example
          title="Vertical stack"
          description="flexDirection column with a rowGap token."
          code={stackCode}
          align="stretch"
        >
          <StackDemo />
        </Example>
        <Example
          title="Centered row"
          description="The default flex row, centered with a columnGap token."
          code={rowCode}
        >
          <RowDemo />
        </Example>
      </Section>

      <Section
        title="Spacing and color"
        description="Surfaces are built by composing radius, background, border and padding tokens."
      >
        <Example title="Card surface" code={cardCode} align="stretch">
          <CardDemo />
        </Example>
      </Section>

      <Section
        title="Polymorphism"
        description="The as prop selects the underlying element for correct semantics and accessibility, while keeping the same typed style API."
      >
        <Example code={polymorphismCode} align="stretch">
          <PolymorphismDemo />
        </Example>
      </Section>

      <Section
        title="Responsive and pseudo-states"
        description="Any style prop accepts an object keyed by base, the breakpoints and the pseudo-states hover, focus and active. Pair with a transition to animate."
      >
        <Example
          title="Interactive card"
          code={interactiveCode}
          align="stretch"
        >
          <InteractiveDemo />
        </Example>
      </Section>

      <Section
        title="Escape hatches"
        description="Box accepts className and style for things outside the design system."
      >
        <Prose>
          <Text variant="body" color="default">
            Reach for className or style only for concerns the system does not
            model, such as animation keyframes or third-party utility classes.
            Never use them to re-implement a property that already has a typed
            prop. If you write className with a padding or background utility,
            you are using Box wrong.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Props"
        description="The most commonly used props. See the source types for the full set."
      >
        <PropsTable rows={boxProps} slug="box" />
      </Section>
    </>
  )
}
