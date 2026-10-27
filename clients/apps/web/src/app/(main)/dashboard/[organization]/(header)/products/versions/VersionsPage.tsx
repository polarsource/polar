'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Pagination from '@/components/Pagination/Pagination'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useCatalogs, useLiveCatalog } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Grid, List, ListItem, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { HistoryRounded } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useSearchParams } from 'next/navigation'
import { parseAsInteger, useQueryState } from 'nuqs'

const PAGE_SIZE = 20

const shortHash = (catalog: schemas['Catalog']) =>
  catalog.version_hash?.slice(0, 7)

const publishedAt = (catalog: schemas['Catalog']) =>
  catalog.published_at ?? catalog.created_at

const LiveCatalogTile = ({ catalog }: { catalog: schemas['Catalog'] }) => (
  <Box
    flexDirection="column"
    rowGap="xs"
    padding="xl"
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    minWidth={0}
  >
    <Text color="muted">Live catalog</Text>
    <Box alignItems="baseline" columnGap="s" minWidth={0}>
      <Text variant="heading-xxs" truncate>
        {catalog.name ?? shortHash(catalog)}
      </Text>
      {catalog.name ? (
        <Text color="muted" monospace>
          {shortHash(catalog)}
        </Text>
      ) : null}
    </Box>
    <Text color="muted">
      Published <FormattedDateTime datetime={publishedAt(catalog)} />
    </Text>
  </Box>
)

const VersionRow = ({ catalog }: { catalog: schemas['Catalog'] }) => (
  <ListItem size="small" className="px-6 py-4">
    <Box minWidth={0} flexGrow={1} alignItems="center" columnGap="m">
      <Text monospace>{shortHash(catalog)}</Text>
      {catalog.name ? (
        <Text color="muted" truncate>
          {catalog.name}
        </Text>
      ) : null}
      {catalog.status === 'live' ? (
        <Status status="Live" color="green" size="small" />
      ) : null}
    </Box>
    <Text color="muted">
      <FormattedDateTime datetime={publishedAt(catalog)} />
    </Text>
  </ListItem>
)

export default function VersionsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const searchParams = useSearchParams()
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const { data: liveCatalog } = useLiveCatalog(organization.id, true)
  const { data: catalogs, isLoading } = useCatalogs(
    organization.id,
    page,
    PAGE_SIZE,
  )

  return (
    <DashboardBody title="Versions">
      <Box flexDirection="column" rowGap="2xl">
        {liveCatalog ? (
          <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="l">
            <LiveCatalogTile catalog={liveCatalog} />
          </Grid>
        ) : null}
        {isLoading ? null : catalogs && catalogs.items.length > 0 ? (
          <Pagination
            currentPage={page}
            pageSize={PAGE_SIZE}
            totalCount={catalogs.pagination.total_count}
            currentURL={searchParams}
            onPageChange={setPage}
          >
            <List size="small">
              {catalogs.items.map((catalog) => (
                <VersionRow key={catalog.id} catalog={catalog} />
              ))}
            </List>
          </Pagination>
        ) : (
          <EmptyState
            icon={<HistoryRounded />}
            title="No versions yet"
            description="A version is published each time you apply product changes from your config."
          />
        )}
      </Box>
    </DashboardBody>
  )
}
