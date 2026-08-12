'use client'

import { useState } from 'react'
import { Subnav, SubnavItem } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Example,
  PageHeader,
  PropsTable,
  Section,
  type PropRow,
} from '@/components/docs'

const sections = ['Overview', 'Top Customers', 'At Risk', 'Cost Drivers']

function BasicDemo() {
  const [active, setActive] = useState('Overview')
  return (
    <Subnav label="Customer sections">
      {sections.map((section) => (
        <SubnavItem key={section} active={active === section}>
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault()
              setActive(section)
            }}
          >
            {section}
          </a>
        </SubnavItem>
      ))}
    </Subnav>
  )
}

function PagePlacementDemo() {
  const [active, setActive] = useState('Top Customers')
  return (
    <Box flexDirection="column" rowGap="xl" flex={1}>
      <Subnav label="Customer sections">
        {sections.map((section) => (
          <SubnavItem key={section} active={active === section}>
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault()
                setActive(section)
              }}
            >
              {section}
            </a>
          </SubnavItem>
        ))}
      </Subnav>
      <Box
        height={96}
        borderRadius="m"
        backgroundColor="background-card"
        alignItems="center"
        justifyContent="center"
      />
    </Box>
  )
}

const basicCode = `import Link from 'next/link'
import { Subnav, SubnavItem } from '@polar-sh/orbit'

<Subnav label="Customer sections">
  <SubnavItem active={pathname === overviewHref}>
    <Link href={overviewHref}>Overview</Link>
  </SubnavItem>
  <SubnavItem active={pathname === topHref}>
    <Link href={topHref}>Top Customers</Link>
  </SubnavItem>
</Subnav>`

const placementCode = `<Box flexDirection="column" rowGap="xl">
  <Subnav label="Customer sections">…</Subnav>
  {content}
</Box>`

const subnavProps: PropRow[] = [
  {
    name: 'label',
    type: 'string',
    default: "'Secondary'",
    description:
      'Accessible name for the navigation landmark, distinguishing it from the primary navigation.',
  },
  {
    name: 'children',
    type: 'ReactNode',
    required: true,
    description: 'One or more SubnavItem elements.',
  },
]

const subnavItemProps: PropRow[] = [
  {
    name: 'active',
    type: 'boolean',
    default: 'false',
    description:
      'Marks the item as the section currently shown. Emphasised and exposed via aria-current="page".',
  },
  {
    name: 'children',
    type: 'ReactNode',
    required: true,
    description:
      "The link for the section. Pass your router's link element so client-side navigation is preserved; color and typography are inherited from the item.",
  },
]

export default function SubnavPage() {
  return (
    <>
      <PageHeader
        title="Subnav"
        description="A horizontal row of links for switching between the sections of a page."
      />

      <Section
        title="Basic"
        description="Items wrap the consumer's link element. The active item reads in the primary text color and carries a round indicator dot centered beneath it; the rest are muted until hovered."
      >
        <Example code={basicCode}>
          <BasicDemo />
        </Example>
      </Section>

      <Section
        title="Page placement"
        description="Typically placed between the page header and the content it switches."
      >
        <Example code={placementCode} align="stretch">
          <PagePlacementDemo />
        </Example>
      </Section>

      <Section title="Subnav props">
        <PropsTable rows={subnavProps} slug="subnav" />
      </Section>

      <Section title="SubnavItem props">
        <PropsTable rows={subnavItemProps} slug="subnav" />
      </Section>
    </>
  )
}
