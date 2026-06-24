import { Box } from '@polar-sh/orbit/Box'
import {
  PageHeader,
  Section,
  Prose,
  Example,
  PropsTable,
} from '@/components/docs'
import type { PropRow } from '@/components/docs'
import { Text } from '@polar-sh/orbit'
import type { TextVariant, TextColor } from '@polar-sh/orbit'

const VARIANTS: TextVariant[] = [
  'heading-2xl',
  'heading-xl',
  'heading-l',
  'heading-m',
  'heading-s',
  'heading-xs',
  'heading-xxs',
  'body',
  'default',
  'title',
  'label',
  'caption',
]

const COLORS: TextColor[] = [
  'default',
  'muted',
  'disabled',
  'accent',
  'success',
  'warning',
  'danger',
  'error',
]

const PROPS: PropRow[] = [
  {
    name: 'as',
    type: 'p | span | label | h1..h6 | ...',
    default: 'p',
    description: 'Underlying HTML element.',
  },
  {
    name: 'variant',
    type: 'TextVariant',
    default: 'default',
    description: 'Type-scale style.',
  },
  {
    name: 'monospace',
    type: 'boolean',
    default: 'false',
    description: 'Switches to the mono font family, keeping the variant size.',
  },
  {
    name: 'formatter',
    type: "'number' | 'compact' | function",
    description: 'Formats the children value, e.g. number to 3,290,033.',
  },
  {
    name: 'tabularNums',
    type: 'boolean',
    default: 'false',
    description: 'Aligns figures in columns with tabular numerals.',
  },
  {
    name: 'truncate',
    type: 'boolean | number',
    default: 'false',
    description: 'Clamps to one line (true) or N lines (number) with ellipsis.',
  },
  {
    name: 'color',
    type: 'TextColor',
    default: 'default',
    description: 'Foreground color. Use inherit to adopt a parent Box color.',
  },
  {
    name: 'align',
    type: 'left | center | right | justify',
    description: 'Text alignment.',
  },
  {
    name: 'wrap',
    type: 'wrap | nowrap | balance | pretty',
    description: 'Wrapping behavior.',
  },
  {
    name: 'loading',
    type: 'boolean',
    default: 'false',
    description: 'Renders a skeleton placeholder.',
  },
  {
    name: 'placeholderText',
    type: 'string',
    description: 'Width source for the single-line skeleton.',
  },
  {
    name: 'placeholderNumberOfLines',
    type: 'number',
    default: '1',
    description: 'Lines rendered when loading.',
  },
  {
    name: 'lineThrough',
    type: 'boolean',
    default: 'false',
    description: 'Strikes through the text.',
  },
]

const ALIGN_CODE = `<Text variant="body" wrap="balance" align="center">
  Balanced, centered copy
</Text>`

export default function TypographyPage() {
  return (
    <>
      <PageHeader
        title="Typography"
        description="Text is the variant-driven primitive for every text node. Choose a variant for size and weight, a color token for tone, and an as element for semantics."
      />

      <Section
        title="Type scale"
        description="Headings use the display face at the larger sizes; body, label, and caption cover supporting copy. The monospace prop swaps any variant to the mono font."
      >
        <Box flexDirection="column" rowGap="xl">
          {VARIANTS.map((variant) => (
            <Box
              key={variant}
              alignItems="baseline"
              justifyContent="between"
              columnGap="l"
              flexWrap="wrap"
            >
              <Text variant={variant} as="span">
                The quick brown fox
              </Text>
              <Text monospace color="default">
                {variant}
              </Text>
            </Box>
          ))}
        </Box>
      </Section>

      <Section
        title="Colors"
        description="Color tokens convey tone and status. Headings always render at full contrast regardless of color."
      >
        <Box flexDirection="column" rowGap="m">
          {COLORS.map((color) => (
            <Box key={color} alignItems="baseline" columnGap="l">
              <Box minWidth={96}>
                <Text monospace color="default">
                  {color}
                </Text>
              </Box>
              <Text variant="body" color={color}>
                The quick brown fox jumps over the lazy dog
              </Text>
            </Box>
          ))}
        </Box>
      </Section>

      <Section
        title="Alignment and wrap"
        description="Control flow with align and wrap. Use balance for short headings and pretty for long paragraphs."
      >
        <Prose>
          <Text variant="body" color="default">
            The wrap prop maps to CSS text-wrap. Use balance to even out short,
            multi-line headings and pretty to avoid orphans in body copy.
          </Text>
        </Prose>
        <Example align="stretch" code={ALIGN_CODE}>
          <Box maxWidth={280} marginHorizontal="auto">
            <Text variant="body" wrap="balance" align="center">
              Balanced, centered copy that wraps evenly across its lines
            </Text>
          </Box>
        </Example>
      </Section>

      <Section title="Props" description="The full Text API.">
        <PropsTable rows={PROPS} slug="text" />
      </Section>
    </>
  )
}
