'use client'

import { useState } from 'react'
import { Box } from '@polar-sh/orbit/Box'
import { TextArea } from '@polar-sh/orbit'
import {
  Example,
  PageHeader,
  PropsTable,
  Section,
  type PropRow,
} from '@/components/docs'

function BasicDemo() {
  const [value, setValue] = useState('')
  return (
    <Box width={320}>
      <TextArea
        placeholder="Write a message"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </Box>
  )
}

function ResizeDemo() {
  return (
    <Box flexDirection="column" rowGap="m" width={320}>
      <TextArea placeholder="Resizable (default)" />
      <TextArea placeholder="Fixed height" resizable={false} />
    </Box>
  )
}

function DisabledDemo() {
  return (
    <Box width={320}>
      <TextArea value="This field is read only." disabled />
    </Box>
  )
}

const basicCode = `const [value, setValue] = useState('')

<TextArea
  placeholder="Write a message"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>`

const resizeCode = `<TextArea placeholder="Resizable (default)" />
<TextArea placeholder="Fixed height" resizable={false} />`

const disabledCode = `<TextArea value="This field is read only." disabled />`

const textAreaProps: PropRow[] = [
  {
    name: 'resizable',
    type: 'boolean',
    default: 'true',
    description: 'When false, disables the resize handle and locks the height.',
  },
  {
    name: 'value',
    type: 'string',
    description: 'Controlled value.',
  },
  {
    name: 'onChange',
    type: '(e: ChangeEvent<HTMLTextAreaElement>) => void',
    description: 'Called on every keystroke.',
  },
  {
    name: 'placeholder',
    type: 'string',
    description: 'Placeholder shown when empty.',
  },
  {
    name: 'rows',
    type: 'number',
    description: 'Initial visible number of text lines.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Prevents interaction and dims the field.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Merged onto the textarea via tailwind-merge.',
  },
]

export default function TextAreaPage() {
  return (
    <>
      <PageHeader
        title="TextArea"
        description="A multi-line text field for longer free-form input, resizable by default."
      />

      <Section
        title="Basic"
        description="A controlled multi-line field driven by React state."
      >
        <Example code={basicCode} align="stretch">
          <BasicDemo />
        </Example>
      </Section>

      <Section
        title="Resizing"
        description="Resizable by default. Pass resizable={false} to lock the height."
      >
        <Example code={resizeCode} align="stretch">
          <ResizeDemo />
        </Example>
      </Section>

      <Section
        title="Disabled"
        description="A disabled field cannot be focused or edited."
      >
        <Example code={disabledCode} align="stretch">
          <DisabledDemo />
        </Example>
      </Section>

      <Section title="Props">
        <PropsTable rows={textAreaProps} />
      </Section>
    </>
  )
}
