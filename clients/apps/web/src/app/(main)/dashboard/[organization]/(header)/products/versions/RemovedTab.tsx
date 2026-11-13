'use client'

import { useRemovedCatalogItems } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Grid, List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { plural } from './[id]/format'

type RemovedItem = schemas['RemovedCatalogItem']

const kinds = [
  { resource: 'product', title: 'Products' },
  { resource: 'benefit', title: 'Benefits' },
  { resource: 'meter', title: 'Meters' },
] as const

const paths = { product: '', benefit: '/benefits', meter: '/meters' } as const

const columns = {
  base: 'minmax(0, 1fr) 112px 16px',
  md: 'minmax(0, 1fr) 200px 112px 16px',
}

const RemovedRow = ({
  organization,
  item,
}: {
  organization: schemas['Organization']
  item: RemovedItem
}) => {
  const router = useRouter()
  const base = `/dashboard/${organization.slug}/products`
  const href = `${base}${paths[item.resource]}/${item.last_item_id}`
  const removedIn = item.removed_in_catalog
  const stop = (event: React.MouseEvent) => event.stopPropagation()
  return (
    <ListItem onSelect={() => router.push(href)}>
      <Grid
        templateColumns={columns}
        columnGap="l"
        alignItems="center"
        width="100%"
      >
        <Box alignItems="baseline" columnGap="s" minWidth={0}>
          <Link href={href} onClick={stop} className="truncate text-base">
            {item.name}
          </Link>
          <Box display={{ base: 'none', md: 'flex' }} minWidth={0}>
            <Text variant="caption" monospace color="muted" truncate>
              {item.external_id}
            </Text>
          </Box>
        </Box>
        <Box display={{ base: 'none', md: 'flex' }} minWidth={0}>
          <Text color="muted" truncate>
            Removed in{' '}
            <Link
              href={`${base}/versions/${removedIn.id}`}
              onClick={stop}
              className="text-gray-950 underline decoration-current/30 underline-offset-4 hover:decoration-current dark:text-white"
            >
              {removedIn.name ?? 'Untitled'}
            </Link>
          </Text>
        </Box>
        <Box justifyContent="end">
          {item.status === 'deprecated' ? (
            <Text tabularNums>{plural(item.customers_count, 'customer')}</Text>
          ) : (
            <Text color="muted">Removed</Text>
          )}
        </Box>
        <Text color="muted">
          <ChevronRight size={16} aria-hidden="true" />
        </Text>
      </Grid>
    </ListItem>
  )
}

export const RemovedTab = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { data: removed, isError } = useRemovedCatalogItems(organization.id)

  if (!removed) {
    return (
      <Text color="muted">
        {isError ? 'Couldn’t load removed items.' : 'Loading removed items…'}
      </Text>
    )
  }

  if (!removed.length) {
    return <Text color="muted">Nothing has been removed from the catalog.</Text>
  }

  return (
    <Box flexDirection="column" rowGap="2xl">
      <Text variant="body" color="muted">
        Existing customers keep deprecated items until they cancel or switch.
        Once no customers are left, the item is removed and safe to delete from
        your config.
      </Text>
      {kinds.map(({ resource, title }) => {
        const items = removed
          .filter((item) => item.resource === resource)
          .sort((a, b) => b.customers_count - a.customers_count)
        if (!items.length) return null
        return (
          <Box key={resource} as="section" flexDirection="column" rowGap="m">
            <h2 className="flex items-baseline gap-x-2 text-base">
              {title}
              <Text as="span" color="muted" tabularNums>
                {items.length}
              </Text>
            </h2>
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
      })}
    </Box>
  )
}
