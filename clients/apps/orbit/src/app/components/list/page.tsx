'use client'

import { List, ListGroup, ListItem, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { PropRow } from '@/components/docs'
import {
  Example,
  PageHeader,
  Prose,
  PropsTable,
  Section,
} from '@/components/docs'

const basicCode = `<List>
  <ListItem>
    <Text>Email notifications</Text>
    <Status status="On" color="green" size="small" />
  </ListItem>
  <ListItem>
    <Text>Two-factor authentication</Text>
    <Status status="Off" color="gray" size="small" />
  </ListItem>
  <ListItem>
    <Text>API access</Text>
    <Status status="On" color="green" size="small" />
  </ListItem>
</List>`

const selectableCode = `const [selected, setSelected] = useState('overview')

<List size="small">
  {items.map((item) => (
    <ListItem
      key={item.id}
      size="small"
      selected={selected === item.id}
      onSelect={() => setSelected(item.id)}
    >
      <Text>{item.label}</Text>
    </ListItem>
  ))}
</List>`

const groupCode = `<ListGroup>
  <ListGroup.Item>
    <Text variant="label">Profile</Text>
    <Text color="muted">Name, avatar and contact details.</Text>
  </ListGroup.Item>
  <ListGroup.Item>
    <Text variant="label">Billing</Text>
    <Text color="muted">Payment methods and invoices.</Text>
  </ListGroup.Item>
</ListGroup>`

const listProps: PropRow[] = [
  {
    name: 'children',
    type: 'ReactNode',
    description: 'ListItem rows. Renders nothing when empty.',
  },
  {
    name: 'size',
    type: "'small' | 'default'",
    default: "'default'",
    description: 'Controls the corner radius of the list container.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Classes merged onto the list container.',
  },
]

const listItemProps: PropRow[] = [
  {
    name: 'children',
    type: 'ReactNode',
    required: true,
    description:
      'Row content. Laid out as a space-between row, so a leading and trailing node sit at each edge.',
  },
  {
    name: 'selected',
    type: 'boolean',
    default: 'false',
    description: 'Applies the selected surface treatment.',
  },
  {
    name: 'onSelect',
    type: '(e: React.MouseEvent) => void',
    description:
      'Click handler. When set, the row becomes a pointer target with hover affordance.',
  },
  {
    name: 'size',
    type: "'small' | 'default'",
    default: "'default'",
    description: 'Controls the row padding.',
  },
  {
    name: 'selectedClassName',
    type: 'string',
    description: 'Extra classes applied only when selected is true.',
  },
  {
    name: 'inactiveClassName',
    type: 'string',
    description: 'Extra classes applied only when selected is false.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Classes merged onto the row in all states.',
  },
]

const listGroupProps: PropRow[] = [
  {
    name: 'children',
    type: 'ReactNode',
    description:
      'Use ListGroup.Item children. Each item is separated by a top border.',
  },
]

export default function ListPage() {
  return (
    <>
      <PageHeader
        title="List"
        description="Bordered, divided rows for settings, menus and records. Compose List with ListItem, and group titled sections with ListGroup."
      />

      <Section
        title="Overview"
        description="List wraps a column of ListItem rows with a border and dividers. Each ListItem lays its children out as a space-between row, so a label and a trailing control align to each edge."
      >
        <Prose>
          <Text color="muted">
            Build row content with Box and Text. Make rows interactive by
            passing onSelect and toggling selected. ListGroup is a separate
            primitive for stacking titled sections such as a settings page.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Basic"
        description="A list of settings rows, each pairing a label with a trailing Status chip."
      >
        <Example code={basicCode} align="stretch">
          <Box width="100%">
            <List>
              <ListItem>
                <Text>Email notifications</Text>
                <Status status="On" color="green" size="small" />
              </ListItem>
              <ListItem>
                <Text>Two-factor authentication</Text>
                <Status status="Off" color="gray" size="small" />
              </ListItem>
              <ListItem>
                <Text>API access</Text>
                <Status status="On" color="green" size="small" />
              </ListItem>
            </List>
          </Box>
        </Example>
      </Section>

      <Section
        title="Selectable"
        description="A compact list using size small. Pass selected and onSelect to turn rows into a selectable menu."
      >
        <Example code={selectableCode} align="stretch">
          <Box width="100%">
            <List size="small">
              <ListItem size="small" selected onSelect={() => {}}>
                <Text>Overview</Text>
              </ListItem>
              <ListItem size="small" onSelect={() => {}}>
                <Text>Customers</Text>
              </ListItem>
              <ListItem size="small" onSelect={() => {}}>
                <Text>Invoices</Text>
              </ListItem>
            </List>
          </Box>
        </Example>
      </Section>

      <Section
        title="ListGroup"
        description="ListGroup stacks titled sections in a single rounded container, separated by borders. Use it for grouped settings or summaries."
      >
        <Example code={groupCode} align="stretch">
          <Box width="100%">
            <ListGroup>
              <ListGroup.Item>
                <Box flexDirection="column" rowGap="xs">
                  <Text variant="label">Profile</Text>
                  <Text color="muted">Name, avatar and contact details.</Text>
                </Box>
              </ListGroup.Item>
              <ListGroup.Item>
                <Box flexDirection="column" rowGap="xs">
                  <Text variant="label">Billing</Text>
                  <Text color="muted">Payment methods and invoices.</Text>
                </Box>
              </ListGroup.Item>
            </ListGroup>
          </Box>
        </Example>
      </Section>

      <Section title="List props">
        <PropsTable rows={listProps} />
      </Section>

      <Section title="ListItem props">
        <PropsTable rows={listItemProps} />
      </Section>

      <Section title="ListGroup props">
        <PropsTable rows={listGroupProps} />
      </Section>
    </>
  )
}
