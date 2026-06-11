'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import type { PropRow } from '@/components/docs'
import {
  Example,
  PageHeader,
  Prose,
  PropsTable,
  Section,
} from '@/components/docs'

const basicCode = `<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="activity">Activity</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Overview content</TabsContent>
  <TabsContent value="activity">Activity content</TabsContent>
  <TabsContent value="settings">Settings content</TabsContent>
</Tabs>`

const controlledCode = `const [tab, setTab] = useState('monthly')

<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="monthly">Monthly</TabsTrigger>
    <TabsTrigger value="yearly">Yearly</TabsTrigger>
  </TabsList>
  <TabsContent value="monthly">Billed every month</TabsContent>
  <TabsContent value="yearly">Billed once a year</TabsContent>
</Tabs>`

const tabsProps: PropRow[] = [
  {
    name: 'value',
    type: 'string',
    description: 'The active tab value when used as a controlled component.',
  },
  {
    name: 'defaultValue',
    type: 'string',
    description: 'The initial active tab when used uncontrolled.',
  },
  {
    name: 'onValueChange',
    type: '(value: string) => void',
    description: 'Called when the active tab changes.',
  },
  {
    name: 'orientation',
    type: "'horizontal' | 'vertical'",
    default: "'horizontal'",
    description: 'Orientation of the tab list for keyboard navigation.',
  },
]

const tabsListProps: PropRow[] = [
  {
    name: 'vertical',
    type: 'boolean',
    default: 'false',
    description: 'Stacks the triggers in a column instead of a row.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Classes merged onto the list container.',
  },
]

const tabsTriggerProps: PropRow[] = [
  {
    name: 'value',
    type: 'string',
    required: true,
    description: 'Identifies which TabsContent this trigger activates.',
  },
  {
    name: 'size',
    type: "'default' | 'small'",
    default: "'default'",
    description: 'Controls the trigger text size.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Prevents the trigger from being selected.',
  },
]

const tabsContentProps: PropRow[] = [
  {
    name: 'value',
    type: 'string',
    required: true,
    description: 'Matches the value of the TabsTrigger that reveals it.',
  },
]

function BasicTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <Box paddingTop="l">
        <TabsContent value="overview">
          <Text color="muted">A summary of recent revenue and customers.</Text>
        </TabsContent>
        <TabsContent value="activity">
          <Text color="muted">The latest events across your account.</Text>
        </TabsContent>
        <TabsContent value="settings">
          <Text color="muted">Configure billing, members and webhooks.</Text>
        </TabsContent>
      </Box>
    </Tabs>
  )
}

function ControlledTabs() {
  const [tab, setTab] = useState('monthly')
  return (
    <Box flexDirection="column" rowGap="m">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>
        <Box paddingTop="l">
          <TabsContent value="monthly">
            <Text color="muted">Billed every month, cancel anytime.</Text>
          </TabsContent>
          <TabsContent value="yearly">
            <Text color="muted">Billed once a year at a discount.</Text>
          </TabsContent>
        </Box>
      </Tabs>
      <Text variant="caption" color="muted">
        Selected value: {tab}
      </Text>
    </Box>
  )
}

export default function TabsPage() {
  return (
    <>
      <PageHeader
        title="Tabs"
        description="A compound, Radix-based component for switching between related views. Compose Tabs with TabsList, TabsTrigger and TabsContent."
      />

      <Section
        title="Overview"
        description="Each TabsTrigger is linked to a TabsContent by a shared value. Tabs can be uncontrolled with defaultValue or controlled with value and onValueChange."
      >
        <Prose>
          <Text color="muted">
            Tabs is built on Radix primitives, so keyboard navigation, focus
            management and ARIA roles are handled for you. Wrap content in Box
            and Text to lay out each panel.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Basic"
        description="An uncontrolled set of tabs using defaultValue. The first trigger is active on mount."
      >
        <Example code={basicCode} align="stretch">
          <BasicTabs />
        </Example>
      </Section>

      <Section
        title="Controlled"
        description="Drive the active tab from state with value and onValueChange to keep selection in sync with the rest of your UI."
      >
        <Example code={controlledCode} align="stretch">
          <ControlledTabs />
        </Example>
      </Section>

      <Section title="Tabs props">
        <PropsTable rows={tabsProps} />
      </Section>

      <Section title="TabsList props">
        <PropsTable rows={tabsListProps} />
      </Section>

      <Section title="TabsTrigger props">
        <PropsTable rows={tabsTriggerProps} />
      </Section>

      <Section title="TabsContent props">
        <PropsTable rows={tabsContentProps} />
      </Section>
    </>
  )
}
