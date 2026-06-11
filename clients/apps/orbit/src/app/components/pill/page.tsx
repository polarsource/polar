import { Pill } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { PropRow } from '@/components/docs'
import { Example, PageHeader, PropsTable, Section } from '@/components/docs'

const colorsCode = `<Pill color="gray">Gray</Pill>
<Pill color="blue">Blue</Pill>
<Pill color="purple">Purple</Pill>
<Pill color="yellow">Yellow</Pill>
<Pill color="red">Red</Pill>
<Pill color="green">Green</Pill>`

const usageCode = `<Pill color="green">Active</Pill>
<Pill color="yellow">Pending</Pill>
<Pill color="red">Failed</Pill>`

const pillProps: PropRow[] = [
  {
    name: 'children',
    type: 'ReactNode',
    required: true,
    description: 'Pill content, typically a short label.',
  },
  {
    name: 'color',
    type: "'gray' | 'blue' | 'purple' | 'yellow' | 'red' | 'green'",
    required: true,
    description: 'Color treatment of the pill. There is no default.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Classes merged onto the pill element.',
  },
]

export default function PillPage() {
  return (
    <>
      <PageHeader
        title="Pill"
        description="A small rounded label for tags, counts and inline metadata. Color is required."
      />

      <Section
        title="Colors"
        description="Six color treatments. Each resolves a light and dark variant automatically."
      >
        <Example code={colorsCode}>
          <Box alignItems="center" columnGap="s" rowGap="s" flexWrap="wrap">
            <Pill color="gray">Gray</Pill>
            <Pill color="blue">Blue</Pill>
            <Pill color="purple">Purple</Pill>
            <Pill color="yellow">Yellow</Pill>
            <Pill color="red">Red</Pill>
            <Pill color="green">Green</Pill>
          </Box>
        </Example>
      </Section>

      <Section
        title="Usage"
        description="Pair a color with a concise label to convey state at a glance."
      >
        <Example code={usageCode}>
          <Box alignItems="center" columnGap="s" rowGap="s" flexWrap="wrap">
            <Pill color="green">Active</Pill>
            <Pill color="yellow">Pending</Pill>
            <Pill color="red">Failed</Pill>
          </Box>
        </Example>
      </Section>

      <Section title="Props">
        <PropsTable rows={pillProps} />
      </Section>
    </>
  )
}
