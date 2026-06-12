import { Truncated } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import type { PropRow } from '@/components/docs'
import { Example, PageHeader, PropsTable, Section } from '@/components/docs'

const longText =
  'This is a long string that will not fit within the constrained width of its container and therefore needs to be truncated.'

const singleLineCode = `<Box width={280}>
  <Truncated>{longText}</Truncated>
</Box>`

const multiLineCode = `<Box width={280}>
  <Truncated lines={2}>{longText}</Truncated>
</Box>`

const customTooltipCode = `<Box width={280}>
  <Truncated tooltip={<CustomTooltip />}>{longText}</Truncated>
</Box>`

const truncatedProps: PropRow[] = [
  {
    name: 'children',
    type: 'ReactNode',
    required: true,
    description: 'Content to clamp. Also used as the default tooltip body.',
  },
  {
    name: 'lines',
    type: 'number',
    default: '1',
    description:
      'Number of lines before clamping. One line truncates with an ellipsis; more uses a line clamp.',
  },
  {
    name: 'tooltip',
    type: 'ReactNode',
    description:
      'Custom tooltip content shown on overflow. Defaults to the full children inside a card.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Classes merged onto the clamping wrapper.',
  },
]

export default function TruncatedPage() {
  return (
    <>
      <PageHeader
        title="Truncated"
        description="Clamps overflowing content and reveals the full value in a tooltip, but only when the content actually overflows."
      />

      <Section
        title="Single line"
        description="The default clamps to one line with an ellipsis. Hover or focus the text to see the full value."
      >
        <Example code={singleLineCode} align="start">
          <Box width={280}>
            <Truncated>{longText}</Truncated>
          </Box>
        </Example>
      </Section>

      <Section
        title="Multiple lines"
        description="Set lines to clamp to a fixed number of lines using a line clamp."
      >
        <Example code={multiLineCode} align="start">
          <Box width={280}>
            <Truncated lines={2}>{longText}</Truncated>
          </Box>
        </Example>
      </Section>

      <Section
        title="No overflow"
        description="When the content fits, nothing is clamped and no tooltip is attached."
      >
        <Example align="start">
          <Box width={280}>
            <Truncated>Short label</Truncated>
          </Box>
        </Example>
      </Section>

      <Section
        title="Custom tooltip"
        description="Pass tooltip to replace the default card with your own content."
      >
        <Example code={customTooltipCode} align="start">
          <Box width={280}>
            <Truncated
              tooltip={
                <Box
                  backgroundColor="background-inverse"
                  color="text-primary"
                  borderRadius="s"
                  paddingHorizontal="m"
                  paddingVertical="s"
                  maxWidth={320}
                >
                  <Text color="inverse">{longText}</Text>
                </Box>
              }
            >
              {longText}
            </Truncated>
          </Box>
        </Example>
      </Section>

      <Section title="Props">
        <PropsTable rows={truncatedProps} slug="truncated" />
      </Section>
    </>
  )
}
