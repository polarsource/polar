'use client'

// PROTOTYPE: products and benefits that are no longer in the catalog, split by
// whether customers still use them. Throwaway.
import { schemas } from '@polar-sh/client'
import { Grid, List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from '@polar-sh/orbit/icons'
import { useBenefits } from '@/hooks/queries/benefits'
import { latestVersions, useSelectedProducts } from '@/hooks/queries/products'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { plural } from '../[id]/format'
import { Entity, History, versionLabel } from './history'

const kindLabel = { product: 'Product', benefit: 'Benefit' } as const

const columns = {
  base: 'minmax(0, 1fr) 112px 16px',
  md: 'minmax(0, 1fr) 80px 200px 112px 16px',
}

const RemovedRow = ({
  organization,
  history,
  entity,
  id,
}: {
  organization: schemas['Organization']
  history: History
  entity: Entity
  id: string | undefined
}) => {
  const router = useRouter()
  const base = `/dashboard/${organization.slug}/products`
  const href = id
    ? entity.kind === 'product'
      ? `${base}/${id}`
      : `${base}/benefits/${id}`
    : null
  const removedIn = history.versions[entity.lastIndex + 1]?.catalog
  const stop = (event: React.MouseEvent) => event.stopPropagation()
  return (
    <ListItem onSelect={href ? () => router.push(href) : undefined}>
      <Grid
        templateColumns={columns}
        columnGap="l"
        alignItems="center"
        width="100%"
      >
        {href ? (
          <Link href={href} onClick={stop} className="truncate text-base">
            {entity.name}
          </Link>
        ) : (
          <span className="truncate text-base">{entity.name}</span>
        )}
        <Box display={{ base: 'none', md: 'flex' }}>
          <Text color="muted">{kindLabel[entity.kind]}</Text>
        </Box>
        <Box display={{ base: 'none', md: 'flex' }} minWidth={0}>
          {removedIn ? (
            <Text color="muted" truncate>
              Removed in{' '}
              <Link
                href={`${base}/versions/${removedIn.id}`}
                onClick={stop}
                className="text-gray-950 underline decoration-current/30 underline-offset-4 hover:decoration-current dark:text-white"
              >
                {versionLabel(history.versions, entity.lastIndex + 1)}
              </Link>
            </Text>
          ) : null}
        </Box>
        <Box justifyContent="end">
          {entity.status === 'retired' ? (
            <Text tabularNums>
              {entity.customers === null
                ? 'In use'
                : plural(entity.customers, 'customer')}
            </Text>
          ) : null}
        </Box>
        <Text color="muted">
          {href ? <ChevronRight size={16} aria-hidden="true" /> : null}
        </Text>
      </Grid>
    </ListItem>
  )
}

// The dashboard page of each removed item, by kind and external ID
const useItemIds = (
  organization: schemas['Organization'],
  removed: Entity[],
) => {
  const externalIds = (kind: Entity['kind']) =>
    removed.filter((entity) => entity.kind === kind).map(({ key }) => key)
  const { data: products } = useSelectedProducts(
    { organization_id: organization.id, external_id: externalIds('product') },
    { includeArchived: true, includeAllVersions: true },
  )
  const { data: benefits } = useBenefits(organization.id, {
    external_id: externalIds('benefit'),
    catalog_status: null,
    limit: 100,
  })
  return new Map([
    ...latestVersions(products ?? []).map(
      ({ external_id, id }) => [`product:${external_id}`, id] as const,
    ),
    ...(benefits?.items ?? []).map(
      ({ external_id, id }) => [`benefit:${external_id}`, id] as const,
    ),
  ])
}

const groups = [
  {
    status: 'retired',
    title: 'Still in use',
    description:
      'New customers can’t buy these. Existing customers keep them until they cancel or switch.',
  },
  {
    status: 'removed',
    title: 'No customers left',
    description: null,
  },
] as const

export const RemovedTab = ({
  organization,
  history,
}: {
  organization: schemas['Organization']
  history: History
}) => {
  const removed = history.entities
    .filter(({ status }) => status !== 'live')
    .sort((a, b) => b.lastIndex - a.lastIndex)
  const ids = useItemIds(organization, removed)

  if (!removed.length) {
    return <Text color="muted">Nothing has been removed from the catalog.</Text>
  }

  return (
    <Box flexDirection="column" rowGap="2xl">
      {groups.map(({ status, title, description }) => {
        const items = removed
          .filter((entity) => entity.status === status)
          .sort((a, b) => (b.customers ?? 0) - (a.customers ?? 0))
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
              {items.map((entity) => (
                <RemovedRow
                  key={`${entity.kind}:${entity.key}`}
                  organization={organization}
                  history={history}
                  entity={entity}
                  id={ids.get(`${entity.kind}:${entity.key}`)}
                />
              ))}
            </List>
          </Box>
        )
      })}
    </Box>
  )
}
