'use client'

import { useRemovedCatalogItems } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Grid, List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  ChevronRight,
  DiamondOutlined,
  HiveOutlined,
} from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { plural } from './[id]/format'

type RemovedItem = schemas['RemovedCatalogItem']

// Same icons as the Products and Benefits sidebar items
const kinds = {
  product: { label: 'Product', Icon: HiveOutlined },
  benefit: { label: 'Benefit', Icon: DiamondOutlined },
} as const

const columns = {
  base: 'minmax(0, 1fr) 112px 16px',
  md: 'minmax(0, 1fr) 104px 200px 112px 16px',
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
  const href =
    item.resource === 'product'
      ? `${base}/${item.last_item_id}`
      : `${base}/benefits/${item.last_item_id}`
  const removedIn = item.removed_in_catalog
  const { label, Icon } = kinds[item.resource]
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
        <Box
          display={{ base: 'none', md: 'flex' }}
          alignItems="center"
          columnGap="s"
        >
          <Text as="span" color="muted">
            <Icon fontSize="inherit" aria-hidden="true" />
          </Text>
          <Text color="muted">{label}</Text>
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
          ) : null}
        </Box>
        <Text color="muted">
          <ChevronRight size={16} aria-hidden="true" />
        </Text>
      </Grid>
    </ListItem>
  )
}

const groups = [
  {
    status: 'deprecated',
    title: 'Deprecated',
    description:
      'Still in use. New customers can’t buy these. Existing customers keep them until they cancel or switch.',
  },
  {
    status: 'removed',
    title: 'Removed',
    description: 'No customers left.',
  },
] as const

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
      {groups.map(({ status, title, description }) => {
        const items = removed
          .filter((item) => item.status === status)
          .sort((a, b) => b.customers_count - a.customers_count)
        if (!items.length) return null
        return (
          <Box key={status} as="section" flexDirection="column" rowGap="m">
            <Box flexDirection="column" rowGap="xs">
              <h2 className="flex items-baseline gap-x-2 text-base">
                {title}
                <Text as="span" color="muted" tabularNums>
                  {items.length}
                </Text>
              </h2>
              {description ? <Text color="muted">{description}</Text> : null}
            </Box>
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
