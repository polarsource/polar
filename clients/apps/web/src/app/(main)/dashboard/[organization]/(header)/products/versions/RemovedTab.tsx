'use client'

import { useRemovedCatalogItems } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Alert, Grid, List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type RemovedItem = schemas['RemovedCatalogItem']

const sections = [
  { resource: 'product', title: 'Products' },
  { resource: 'benefit', title: 'Benefits' },
  { resource: 'meter', title: 'Meters' },
] as const

const paths = { product: '', benefit: '/benefits', meter: '/meters' } as const

const usage = {
  product: 'subscribed',
  benefit: 'with access',
  meter: 'billed',
} as const

const columns = {
  base: 'minmax(0, 1fr) 112px 16px',
  md: 'minmax(0, 1fr) 160px 112px 16px',
}

const RemovedRow = ({
  organization,
  item,
}: {
  organization: schemas['Organization']
  item: RemovedItem
}) => {
  const router = useRouter()
  const href = `/dashboard/${organization.slug}/products${paths[item.resource]}/${item.last_item_id}`
  const stop = (event: React.MouseEvent) => event.stopPropagation()
  return (
    <ListItem onSelect={() => router.push(href)}>
      <Grid
        templateColumns={columns}
        columnGap="l"
        alignItems="center"
        width="100%"
      >
        <Text color={item.customers_count ? undefined : 'muted'} truncate>
          <Link href={href} onClick={stop}>
            {item.name}
          </Link>
        </Text>
        <Box display={{ base: 'none', md: 'flex' }} minWidth={0}>
          <Text
            color="muted"
            truncate
            title={`Removed in ${item.removed_in_catalog.name ?? 'Untitled'}`}
          >
            <Link
              href={`/dashboard/${organization.slug}/products/versions/${item.removed_in_catalog.id}`}
              onClick={stop}
              className="hover:underline hover:decoration-current/30 hover:underline-offset-4"
            >
              {item.removed_in_catalog.name ?? 'Untitled'}
            </Link>
          </Text>
        </Box>
        <Box justifyContent="end" minWidth={0}>
          <Text tabularNums truncate>
            {item.customers_count
              ? `${item.customers_count.toLocaleString()} ${usage[item.resource]}`
              : null}
          </Text>
        </Box>
        <Text color="muted">
          <ChevronRight size={16} aria-hidden="true" />
        </Text>
      </Grid>
    </ListItem>
  )
}

const RemovedSection = ({
  organization,
  title,
  items,
}: {
  organization: schemas['Organization']
  title: string
  items: RemovedItem[]
}) => {
  if (!items.length) return null
  return (
    <Box as="section" flexDirection="column" rowGap="m">
      <Text as="h2" variant="body">
        {title}
      </Text>
      <List size="small">
        {items.map((item) => (
          <RemovedRow
            key={`${item.resource}:${item.external_id}`}
            organization={organization}
            item={item}
          />
        ))}
      </List>
    </Box>
  )
}

export const RemovedTab = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const {
    data: removed,
    isError,
    refetch,
  } = useRemovedCatalogItems(organization.id)

  if (isError) {
    return (
      <Alert
        variant="danger"
        title="Could not load removed items"
        actions={[{ text: 'Retry', onClick: () => refetch() }]}
      />
    )
  }

  if (!removed) return null

  return (
    <Box flexDirection="column" rowGap="2xl">
      <Text variant="body" color="muted">
        Customers keep removed items until they cancel or switch.
      </Text>
      {sections.map(({ resource, title }) => (
        <RemovedSection
          key={resource}
          organization={organization}
          title={title}
          // Stable sort: items without customers keep the newest-removal-first API order
          items={removed
            .filter((item) => item.resource === resource)
            .sort((a, b) => b.customers_count - a.customers_count)}
        />
      ))}
    </Box>
  )
}
