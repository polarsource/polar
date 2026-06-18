import { Text } from '@polar-sh/orbit'
import {
  Example,
  PageHeader,
  Prose,
  PropsTable,
  Section,
  type PropRow,
} from '@/components/docs'
import {
  BestPractices,
  ColorSamples,
  MonospaceSamples,
  NumberSamples,
  StateSamples,
  TruncateSamples,
  VariantSamples,
} from './examples'

const variantCode = `<Text variant="heading-l">Page title</Text>
<Text variant="body">Comfortable reading copy.</Text>
<Text variant="label">Field label</Text>`

const monospaceCode = `<Text variant="heading-s" monospace>404</Text>
<Text variant="body" monospace>npm install @polar-sh/orbit</Text>
<Text variant="label" monospace>POLAR_TOKEN</Text>`

const numberCode = `<Text variant="heading-s" formatter="number">{3290033}</Text>
<Text variant="body" formatter="compact">{3290033}</Text>
<Text formatter={(v) => \`$\${v}\`}>{42}</Text>`

const truncateCode = `<Text variant="body" truncate>One line, then an ellipsis…</Text>
<Text variant="body" truncate={2}>Clamped to two lines…</Text>`

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
      'default | body | label | caption | heading-2xl | heading-xl | heading-l | heading-m | heading-s | heading-xs | heading-xxs.',
  },
  {
    name: 'monospace',
    type: 'boolean',
    default: 'false',
    description:
      'Renders the text in the monospace font family while keeping the size and weight from variant. Pair with any variant.',
  },
  {
    name: 'formatter',
    type: "'number' | 'compact' | ((value) => string)",
    description:
      "Formats the children value for display. 'number' adds grouping separators (3,290,033), 'compact' shortens (3.3M), or pass a function for full control. Pass the raw value as children.",
  },
  {
    name: 'tabularNums',
    type: 'boolean',
    default: 'false',
    description:
      'Uses tabular (monospaced) figures so numbers line up in columns. Ideal for tables and stat readouts.',
  },
  {
    name: 'truncate',
    type: 'boolean | number',
    default: 'false',
    description:
      'true clamps to a single line with an ellipsis; a number clamps to that many lines.',
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
    default: 'inferred from variant',
    description:
      'Underlying element. Defaults to a sensible element per variant (heading variants render h1 to h6, everything else p). Override for the correct document outline. DOM props are forwarded.',
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
]

export default function TextPage() {
  return (
    <>
      <PageHeader
        title="Text"
        description="Variant-driven typography for anything text-related."
      />

      <Section
        title="Overview"
        description="Use Text for any text node, never a div with tailwind text classes. You choose what the text is; the component decides how it looks."
      >
        <Prose>
          <Text variant="body" color="default">
            Each prop sits on one axis. variant is the role (size, weight and
            font family), color is the tone, and as is the element. Orthogonal
            modifiers layer on without touching the role: monospace,
            tabularNums, truncate, lineThrough and a formatter for numbers.
            Colors resolve light and dark automatically, and loading renders a
            skeleton with no extra markup.
          </Text>
          <Text variant="body" color="muted">
            Text has no className. Size, weight, color and leading are owned by
            the props above, so compose layout and spacing with Box around Text
            rather than reaching for utility classes.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Variants"
        description="Each variant maps to a typographic role. The token name is shown in monospace above each sample."
      >
        <Example code={variantCode} align="stretch">
          <VariantSamples />
        </Example>
      </Section>

      <Section
        title="Monospace"
        description="monospace is a boolean prop, not a variant. It swaps in the mono font family while keeping the size and weight from variant, so any text (a heading, body copy or a label) can be monospaced."
      >
        <Example code={monospaceCode} align="stretch">
          <MonospaceSamples />
        </Example>
      </Section>

      <Section
        title="Formatting"
        description="Pass a raw value as children and a formatter to render it: 'number' for grouping separators, 'compact' for short magnitudes, or a function for anything else. Formatting lives in the component, so call sites never hand-roll toLocaleString. Add tabularNums to align figures in columns."
      >
        <Example code={numberCode} align="stretch">
          <NumberSamples />
        </Example>
      </Section>

      <Section
        title="Truncation"
        description="truncate owns the overflow CSS: true clamps to one line, a number clamps to that many lines."
      >
        <Example code={truncateCode} align="stretch">
          <TruncateSamples />
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

      <Section
        title="Best practices"
        description="Keep typographic decisions inside Text. Choose the role and tone; let the component own the rest."
      >
        <BestPractices />
      </Section>

      <Section title="Props">
        <PropsTable rows={textProps} slug="text" />
      </Section>
    </>
  )
}
