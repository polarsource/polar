'use client'

import { useRemovedCatalogItems } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { RemovedGroup } from './RemovedGroup'

type Item = schemas['RemovedCatalogItem']
type Resource = schemas['RemovedCatalogItemResource']

const resources: { value: Resource; label: string; noun: string }[] = [
  { value: 'product', label: 'Products', noun: 'products' },
  { value: 'benefit', label: 'Benefits', noun: 'benefits' },
]

export default function RemovedPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [resource, setResource] = useState<Resource>('product')
  const { data: items } = useRemovedCatalogItems(organization.id)

  const productsPath = `/dashboard/${organization.slug}/products`
  const shown = items?.filter((item) => item.resource === resource) ?? []
  const count = (value: Resource) =>
    items?.filter((item) => item.resource === value).length ?? 0
  const href = (item: Item) =>
    item.resource === 'benefit'
      ? `${productsPath}/benefits/${item.last_item_id}`
      : `${productsPath}/${item.last_item_id}`

  return (
    <Box flexDirection="column" rowGap="2xl" minWidth={0} paddingBottom="2xl">
      <Text color="muted">
        Keys an earlier version listed that the current version doesn&apos;t.
      </Text>
      <Box>
        <SegmentedControl
          options={resources.map(({ value, label }) => ({
            value,
            label: `${label} ${count(value)}`,
          }))}
          value={resource}
          onChange={setResource}
        />
      </Box>
      {items && !shown.length ? (
        <Text color="muted">
          No {resources.find(({ value }) => value === resource)?.noun} removed
          yet.
        </Text>
      ) : null}
      <RemovedGroup
        title="Deprecated · still in use"
        hint="Becomes removed once no customer uses it"
        items={shown.filter((item) => item.status === 'deprecated')}
        href={href}
      />
      <RemovedGroup
        title="Removed · safe to delete from config"
        hint="No customer uses it"
        items={shown.filter((item) => item.status === 'removed')}
        href={href}
      />
    </Box>
  )
}
