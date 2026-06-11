'use client'

import { useState } from 'react'
import { Box } from '@polar-sh/orbit/Box'
import { Checkbox, Text } from '@polar-sh/orbit'
import {
  Example,
  PageHeader,
  Prose,
  PropsTable,
  Section,
  type PropRow,
} from '@/components/docs'

function BasicDemo() {
  const [checked, setChecked] = useState(true)
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(c) => setChecked(c === true)}
    />
  )
}

function StatesDemo() {
  return (
    <Box alignItems="center" columnGap="xl">
      <Checkbox checked={false} />
      <Checkbox checked />
      <Checkbox checked="indeterminate" />
      <Checkbox checked disabled />
    </Box>
  )
}

function LabelDemo() {
  const [checked, setChecked] = useState(false)
  return (
    <Box as="label" alignItems="center" columnGap="s" cursor="pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => setChecked(c === true)}
      />
      <Text variant="label" as="span">
        Send me product updates
      </Text>
    </Box>
  )
}

const basicCode = `const [checked, setChecked] = useState(true)

<Checkbox checked={checked} onCheckedChange={setChecked} />`

const statesCode = `<Checkbox checked={false} />
<Checkbox checked />
<Checkbox checked="indeterminate" />
<Checkbox checked disabled />`

const labelCode = `<Box as="label" alignItems="center" columnGap="s">
  <Checkbox checked={checked} onCheckedChange={setChecked} />
  <Text variant="label" as="span">Send me product updates</Text>
</Box>`

const checkboxProps: PropRow[] = [
  {
    name: 'checked',
    type: "boolean | 'indeterminate'",
    description:
      'Controlled checked state. Pass indeterminate to render the mixed state.',
  },
  {
    name: 'defaultChecked',
    type: "boolean | 'indeterminate'",
    description: 'Initial state when the checkbox is uncontrolled.',
  },
  {
    name: 'onCheckedChange',
    type: "(checked: boolean | 'indeterminate') => void",
    description: 'Called when the checked state changes.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Prevents interaction and dims the control.',
  },
  {
    name: 'required',
    type: 'boolean',
    default: 'false',
    description: 'Marks the field as required within a form.',
  },
  {
    name: 'name',
    type: 'string',
    description: 'Form field name submitted with the form.',
  },
  {
    name: 'value',
    type: 'string',
    description: 'Value submitted when the checkbox is checked.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Merged onto the root element via class names.',
  },
]

export default function CheckboxPage() {
  return (
    <>
      <PageHeader
        title="Checkbox"
        description="A binary control for toggling a single option on or off, with support for an indeterminate mixed state. Built on Radix UI."
      />

      <Section
        title="Overview"
        description="Use Checkbox for boolean choices in forms and lists. It is controlled via checked and onCheckedChange, and accepts the full Radix Checkbox API."
      >
        <Prose>
          <Text variant="body" color="default">
            The indeterminate state communicates a partial selection, such as a
            parent checkbox whose children are only partly selected. Always pair
            a checkbox with a label for accessibility.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Basic"
        description="A controlled checkbox driven by React state."
      >
        <Example code={basicCode}>
          <BasicDemo />
        </Example>
      </Section>

      <Section
        title="States"
        description="Unchecked, checked, indeterminate and disabled."
      >
        <Example code={statesCode}>
          <StatesDemo />
        </Example>
      </Section>

      <Section
        title="With a label"
        description="Wrap the control and its Text in a Box rendered as a label so the whole row is clickable."
      >
        <Example code={labelCode} align="start">
          <LabelDemo />
        </Example>
      </Section>

      <Section title="Props">
        <PropsTable rows={checkboxProps} slug="checkbox" />
      </Section>
    </>
  )
}
