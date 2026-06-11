import { Status } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { PropRow } from '@/components/docs'
import { Example, PageHeader, PropsTable, Section } from '@/components/docs'

const colorsCode = `<Status status="Succeeded" color="green" />
<Status status="Failed" color="red" />
<Status status="Pending" color="yellow" />
<Status status="Processing" color="blue" />
<Status status="Scheduled" color="purple" />
<Status status="Archived" color="gray" />`

const neutralCode = `<Status status="Draft" />`

const sizesCode = `<Status status="Succeeded" color="green" size="small" />
<Status status="Succeeded" color="green" size="medium" />`

const statusProps: PropRow[] = [
  {
    name: 'status',
    type: 'string',
    required: true,
    description: 'The label rendered inside the chip.',
  },
  {
    name: 'color',
    type: "'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray'",
    description:
      'Applies a predefined color treatment. Omit for a neutral, color-less chip.',
  },
  {
    name: 'size',
    type: "'small' | 'medium'",
    default: "'medium'",
    description: 'Controls padding and text size.',
  },
]

export default function StatusPage() {
  return (
    <>
      <PageHeader
        title="Status"
        description="A compact chip that communicates the state of a record. Styling is closed: there is no className escape hatch, and the chip sizes to its content."
      />

      <Section
        title="Colors"
        description="Six color treatments map to common lifecycle states. Each resolves a light and dark variant."
      >
        <Example code={colorsCode}>
          <Box alignItems="center" columnGap="s" rowGap="s" flexWrap="wrap">
            <Status status="Succeeded" color="green" />
            <Status status="Failed" color="red" />
            <Status status="Pending" color="yellow" />
            <Status status="Processing" color="blue" />
            <Status status="Scheduled" color="purple" />
            <Status status="Archived" color="gray" />
          </Box>
        </Example>
      </Section>

      <Section
        title="Neutral"
        description="Omit color for a color-less chip that inherits the surrounding text and surface."
      >
        <Example code={neutralCode}>
          <Status status="Draft" />
        </Example>
      </Section>

      <Section
        title="Sizes"
        description="Two sizes scale the padding and text relative to the chip content."
      >
        <Example code={sizesCode}>
          <Box alignItems="center" columnGap="m">
            <Status status="Succeeded" color="green" size="small" />
            <Status status="Succeeded" color="green" size="medium" />
          </Box>
        </Example>
      </Section>

      <Section
        title="Props"
        description="Status has no className prop. Use color and size to control its appearance."
      >
        <PropsTable rows={statusProps} />
      </Section>
    </>
  )
}
