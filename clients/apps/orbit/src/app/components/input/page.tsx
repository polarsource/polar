'use client'

import { useState } from 'react'
import { Box } from '@polar-sh/orbit/Box'
import { Input } from '@polar-sh/orbit'
import { Search, Mail } from 'lucide-react'
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
    <Box width={280}>
      <Input
        placeholder="Enter your name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </Box>
  )
}

function SlotDemo() {
  const [value, setValue] = useState('')
  return (
    <Box flexDirection="column" rowGap="m" width={280}>
      <Input
        preSlot={<Search className="h-4 w-4" />}
        placeholder="Search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Input
        postSlot={<Mail className="h-4 w-4" />}
        placeholder="you@example.com"
      />
    </Box>
  )
}

function DisabledDemo() {
  return (
    <Box width={280}>
      <Input placeholder="Disabled" value="Read only value" disabled />
    </Box>
  )
}

const basicCode = `const [value, setValue] = useState('')

<Input
  placeholder="Enter your name"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>`

const slotCode = `<Input preSlot={<Search className="h-4 w-4" />} placeholder="Search" />
<Input postSlot={<Mail className="h-4 w-4" />} placeholder="you@example.com" />`

const disabledCode = `<Input placeholder="Disabled" value="Read only value" disabled />`

const inputProps: PropRow[] = [
  {
    name: 'value',
    type: 'string',
    description: 'Controlled input value.',
  },
  {
    name: 'onChange',
    type: '(e: ChangeEvent<HTMLInputElement>) => void',
    description: 'Called on every keystroke.',
  },
  {
    name: 'placeholder',
    type: 'string',
    description: 'Placeholder shown when the input is empty.',
  },
  {
    name: 'type',
    type: "'text' | 'email' | 'password' | ...",
    default: "'text'",
    description: 'Native input type.',
  },
  {
    name: 'preSlot',
    type: 'ReactNode',
    description:
      'Content rendered inside the field on the left, typically an icon. Adds left padding automatically.',
  },
  {
    name: 'postSlot',
    type: 'ReactNode',
    description:
      'Content rendered inside the field on the right. Adds right padding automatically.',
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
    description: 'Merged onto the input element via tailwind-merge.',
  },
]

export default function InputPage() {
  return (
    <>
      <PageHeader
        title="Input"
        description="A single-line text field with optional leading and trailing slots for icons or adornments."
      />

      <Section
        title="Basic"
        description="A controlled text field driven by React state."
      >
        <Example code={basicCode} align="stretch">
          <BasicDemo />
        </Example>
      </Section>

      <Section
        title="Slots"
        description="preSlot renders a leading adornment and postSlot a trailing one. Slots are pointer-transparent so clicks fall through to the field."
      >
        <Example code={slotCode} align="stretch">
          <SlotDemo />
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
        <PropsTable rows={inputProps} slug="input" />
      </Section>
    </>
  )
}
