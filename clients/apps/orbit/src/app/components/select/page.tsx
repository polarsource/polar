'use client'

import { Text } from '@polar-sh/orbit'
import {
  Example,
  PageHeader,
  Prose,
  PropsTable,
  Section,
  type PropRow,
} from '@/components/docs'
import { BasicDemo, GroupedDemo } from './examples'

const basicCode = `const [value, setValue] = useState('')

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select a plan" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="free">Free</SelectItem>
    <SelectItem value="pro">Pro</SelectItem>
    <SelectItem value="scale">Scale</SelectItem>
    <SelectItem value="enterprise" disabled>Enterprise</SelectItem>
  </SelectContent>
</Select>`

const groupedCode = `<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select a timezone" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Americas</SelectLabel>
      <SelectItem value="est">Eastern</SelectItem>
      <SelectItem value="pst">Pacific</SelectItem>
    </SelectGroup>
    <SelectSeparator />
    <SelectGroup>
      <SelectLabel>Europe</SelectLabel>
      <SelectItem value="gmt">London</SelectItem>
      <SelectItem value="cet">Central European</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>`

const selectProps: PropRow[] = [
  {
    name: 'value',
    type: 'string',
    description: 'Controlled value of the selected item.',
  },
  {
    name: 'defaultValue',
    type: 'string',
    description: 'Initial value when the Select is uncontrolled.',
  },
  {
    name: 'onValueChange',
    type: '(value: string) => void',
    description: 'Called when the selected value changes.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Disables the whole control.',
  },
  {
    name: 'open',
    type: 'boolean',
    description: 'Controlled open state of the listbox.',
  },
  {
    name: 'onOpenChange',
    type: '(open: boolean) => void',
    description: 'Called when the open state changes.',
  },
]

const itemProps: PropRow[] = [
  {
    name: 'value',
    type: 'string',
    required: true,
    description: 'Value reported to the Select when this item is chosen.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Prevents the item from being selected.',
  },
  {
    name: 'children',
    type: 'ReactNode',
    description: 'Visible label for the item.',
  },
]

export default function SelectPage() {
  return (
    <>
      <PageHeader
        title="Select"
        description="A compound dropdown for choosing one option from a list. Built on Radix UI Select."
      />

      <Section
        title="Overview"
        description="Select is composed from several parts. Control the value with value and onValueChange on the root, render the closed state inside SelectTrigger with a SelectValue placeholder, and list options as SelectItem inside SelectContent."
      >
        <Prose>
          <Text color="muted">
            The parts are Select (root), SelectTrigger, SelectValue,
            SelectContent, SelectItem, plus SelectGroup, SelectLabel and
            SelectSeparator for organising long lists. Each SelectItem must
            carry a unique value.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Basic"
        description="A controlled Select with a placeholder and a disabled option."
      >
        <Example code={basicCode} align="start">
          <BasicDemo />
        </Example>
      </Section>

      <Section
        title="Grouped"
        description="Use SelectGroup with SelectLabel to title sections and SelectSeparator to divide them."
      >
        <Example code={groupedCode} align="start">
          <GroupedDemo />
        </Example>
      </Section>

      <Section title="Select props">
        <PropsTable rows={selectProps} />
      </Section>

      <Section
        title="SelectItem props"
        description="SelectTrigger, SelectContent, SelectGroup, SelectLabel and SelectSeparator forward their Radix props and accept className."
      >
        <PropsTable rows={itemProps} />
      </Section>
    </>
  )
}
