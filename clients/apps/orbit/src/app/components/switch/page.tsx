'use client'

import { useState } from 'react'
import { Box } from '@polar-sh/orbit/Box'
import { Switch, Text } from '@polar-sh/orbit'
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
  return <Switch checked={checked} onCheckedChange={setChecked} />
}

function StatesDemo() {
  return (
    <Box alignItems="center" columnGap="xl">
      <Switch checked={false} />
      <Switch checked />
      <Switch checked disabled />
      <Switch checked={false} disabled />
    </Box>
  )
}

function LabelDemo() {
  const [checked, setChecked] = useState(false)
  return (
    <Box as="label" alignItems="center" columnGap="s">
      <Switch checked={checked} onCheckedChange={setChecked} />
      <Text variant="label" as="span">
        Enable notifications
      </Text>
    </Box>
  )
}

const basicCode = `const [checked, setChecked] = useState(true)

<Switch checked={checked} onCheckedChange={setChecked} />`

const statesCode = `<Switch checked={false} />
<Switch checked />
<Switch checked disabled />
<Switch checked={false} disabled />`

const labelCode = `<Box as="label" alignItems="center" columnGap="s">
  <Switch checked={checked} onCheckedChange={setChecked} />
  <Text variant="label" as="span">Enable notifications</Text>
</Box>`

const switchProps: PropRow[] = [
  {
    name: 'checked',
    type: 'boolean',
    description: 'Controlled on/off state.',
  },
  {
    name: 'defaultChecked',
    type: 'boolean',
    description: 'Initial state when the switch is uncontrolled.',
  },
  {
    name: 'onCheckedChange',
    type: '(checked: boolean) => void',
    description: 'Called when the switch is toggled.',
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
    default: "'on'",
    description: 'Value submitted when the switch is checked.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Merged onto the root element via class names.',
  },
]

export default function SwitchPage() {
  return (
    <>
      <PageHeader
        title="Switch"
        description="A toggle for instantly turning a single setting on or off. Built on Radix UI."
      />

      <Section
        title="Overview"
        description="Use Switch for settings that take effect immediately, such as enabling a feature. For options confirmed on submit, prefer a Checkbox."
      >
        <Prose>
          <Text color="muted">
            Switch is controlled via checked and onCheckedChange and accepts the
            full Radix Switch API. Pair it with a label so the state is clear.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Basic"
        description="A controlled toggle driven by React state."
      >
        <Example code={basicCode}>
          <BasicDemo />
        </Example>
      </Section>

      <Section
        title="States"
        description="Off, on and disabled in both positions."
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
        <PropsTable rows={switchProps} />
      </Section>
    </>
  )
}
