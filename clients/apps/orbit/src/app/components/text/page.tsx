import { Text } from '@polar-sh/orbit'
import {
  Example,
  PageHeader,
  Prose,
  PropsTable,
  Section,
  type PropRow,
} from '@/components/docs'
import { ColorSamples, StateSamples, VariantSamples } from './examples'

const variantCode = `<Text variant="heading-l" as="h1">Page title</Text>
<Text variant="body">Comfortable reading copy.</Text>
<Text variant="label">Field label</Text>
<Text variant="mono">npm install</Text>`

const colorCode = `<Text color="default">De-emphasised copy</Text>
<Text color="accent">Accent</Text>
<Text color="success">Saved</Text>
<Text color="danger">Something went wrong</Text>`

const stateCode = `<Text loading placeholderText="Loading a single line of text" />
<Text loading placeholderNumberOfLines={3} />
<Text lineThrough color="default">Previous price</Text>`

const textProps: PropRow[] = [
  {
    name: 'variant',
    type: 'TextVariant',
    default: "'default'",
    description:
      'default | body | label | caption | mono | heading-2xl | heading-xl | heading-l | heading-m | heading-s | heading-xs | heading-xxs.',
  },
  {
    name: 'color',
    type: 'TextColor',
    default: "'default'",
    description:
      'default | muted | disabled | accent | danger | error | warning | success | inverse | white | black | inherit.',
  },
  {
    name: 'as',
    type: "'p' | 'span' | 'label' | 'strong' | 'code' | 'h1'..'h6' | …",
    default: "'p'",
    description: 'Underlying element. DOM props for the element are forwarded.',
  },
  {
    name: 'align',
    type: "'left' | 'center' | 'right' | 'justify'",
    description: 'Text alignment.',
  },
  {
    name: 'wrap',
    type: "'wrap' | 'nowrap' | 'balance' | 'pretty'",
    description: 'Wrapping behavior.',
  },
  {
    name: 'loading',
    type: 'boolean',
    default: 'false',
    description: 'Render a pulsing skeleton placeholder instead of children.',
  },
  {
    name: 'placeholderText',
    type: 'string',
    description:
      'Sizes the single-line skeleton. Falls back to children, then Loading...',
  },
  {
    name: 'placeholderNumberOfLines',
    type: 'number',
    default: '1',
    description: 'When greater than 1, renders a multi-line skeleton.',
  },
  {
    name: 'lineThrough',
    type: 'boolean',
    default: 'false',
    description: 'Applies a line-through text decoration.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Merged after the variant classes via tailwind-merge.',
  },
]

export default function TextPage() {
  return (
    <>
      <PageHeader
        title="Text"
        description="Variant-driven typography for every text node. Pick a variant for the role, an optional color token and a semantic element via as. Colors resolve light and dark automatically."
      />

      <Section
        title="Overview"
        description="Use Text for any text node rather than tailwind text classes. The variant sets size, weight and font family; color and alignment layer on top."
      >
        <Prose>
          <Text variant="body" color="default">
            Headings use the display scale and respond to viewport width. Body,
            label, caption and mono cover supporting copy. Built-in loading and
            lineThrough states cover common UI affordances without extra markup.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Variants"
        description="Each variant maps to a typographic role. The token name is shown in mono above each sample."
      >
        <Example code={variantCode} align="stretch">
          <VariantSamples />
        </Example>
      </Section>

      <Section
        title="Colors"
        description="Color tokens auto-resolve for light and dark mode. inverse is shown on an inverse surface."
      >
        <Example code={colorCode} align="stretch">
          <ColorSamples />
        </Example>
      </Section>

      <Section
        title="States"
        description="loading renders a skeleton, single or multi-line. lineThrough strikes the content."
      >
        <Example code={stateCode} align="stretch">
          <StateSamples />
        </Example>
      </Section>

      <Section title="Props">
        <PropsTable rows={textProps} slug="text" />
      </Section>
    </>
  )
}
