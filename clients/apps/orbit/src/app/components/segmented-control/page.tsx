'use client'

import { useState } from 'react'
import { Box } from '@polar-sh/orbit/Box'
import { SegmentedControl } from '@polar-sh/orbit'
import {
  Example,
  PageHeader,
  PropsTable,
  Section,
  type PropRow,
} from '@/components/docs'

const viewOptions = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
]

const rangeOptions = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

function BasicDemo() {
  const [value, setValue] = useState('grid')
  return (
    <SegmentedControl options={viewOptions} value={value} onChange={setValue} />
  )
}

function SizesDemo() {
  const [value, setValue] = useState('week')
  return (
    <Box flexDirection="column" alignItems="center" rowGap="m">
      <SegmentedControl
        options={rangeOptions}
        value={value}
        onChange={setValue}
        size="sm"
      />
      <SegmentedControl
        options={rangeOptions}
        value={value}
        onChange={setValue}
        size="md"
      />
      <SegmentedControl
        options={rangeOptions}
        value={value}
        onChange={setValue}
        size="lg"
      />
    </Box>
  )
}

function TabsDemo() {
  const [value, setValue] = useState('grid')
  return (
    <Box width={360}>
      <SegmentedControl
        options={viewOptions}
        value={value}
        onChange={setValue}
        variant="tabs"
      />
    </Box>
  )
}

const basicCode = `const [value, setValue] = useState('grid')

const options = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
]

<SegmentedControl options={options} value={value} onChange={setValue} />`

const sizesCode = `<SegmentedControl options={options} value={value} onChange={setValue} size="sm" />
<SegmentedControl options={options} value={value} onChange={setValue} size="md" />
<SegmentedControl options={options} value={value} onChange={setValue} size="lg" />`

const tabsCode = `<SegmentedControl
  options={options}
  value={value}
  onChange={setValue}
  variant="tabs"
/>`

const props: PropRow[] = [
  {
    name: 'options',
    type: '{ value: string; label: string }[]',
    required: true,
    description: 'The selectable segments, rendered left to right.',
  },
  {
    name: 'value',
    type: 'string',
    required: true,
    description: 'The currently selected option value.',
  },
  {
    name: 'onChange',
    type: '(value: string) => void',
    required: true,
    description: 'Called with the value of the segment that was clicked.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'Controls padding and text size.',
  },
  {
    name: 'variant',
    type: "'default' | 'tabs'",
    default: "'default'",
    description:
      'default is a compact inline control. tabs fills its container and grows each segment evenly.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Merged onto the container via tailwind-merge.',
  },
]

export default function SegmentedControlPage() {
  return (
    <>
      <PageHeader
        title="Segmented Control"
        description="A compact row of mutually exclusive options for switching between views or modes."
      />

      <Section
        title="Basic"
        description="A controlled control switching between three options."
      >
        <Example code={basicCode}>
          <BasicDemo />
        </Example>
      </Section>

      <Section
        title="Sizes"
        description="Three sizes adjust padding and text size."
      >
        <Example code={sizesCode}>
          <SizesDemo />
        </Example>
      </Section>

      <Section
        title="Tabs variant"
        description="The tabs variant fills the available width and distributes segments evenly, suited to section navigation."
      >
        <Example code={tabsCode} align="stretch">
          <TabsDemo />
        </Example>
      </Section>

      <Section title="Props">
        <PropsTable rows={props} slug="segmented-control" />
      </Section>
    </>
  )
}
