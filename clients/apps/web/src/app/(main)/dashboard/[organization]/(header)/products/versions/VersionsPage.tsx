'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Pagination from '@/components/Pagination/Pagination'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useCatalogs } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import {
  Grid,
  List,
  ListItem,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { HistoryRounded } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { parseAsInteger, useQueryState } from 'nuqs'
import { useState } from 'react'

const PAGE_SIZE = 20

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const publishedAt = (catalog: schemas['Catalog']) =>
  catalog.published_at ?? catalog.created_at

export const StatusBadge = ({ draft }: { draft: boolean }) => (
  <Box
    as="span"
    display="inline-flex"
    paddingHorizontal="m"
    paddingVertical="xs"
    borderRadius="full"
    backgroundColor={draft ? 'background-card' : 'background-inverse'}
  >
    <Text as="span" color={draft ? 'default' : 'inverse'}>
      {draft ? 'Draft' : 'Current'}
    </Text>
  </Box>
)

export const PublishedAt = ({ catalog }: { catalog: schemas['Catalog'] }) => {
  const [now] = useState(() => Date.now())
  const datetime = publishedAt(catalog)

  if (now - new Date(datetime).getTime() >= WEEK_MS) {
    return <FormattedDateTime datetime={datetime} />
  }

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span>
          <PolarTimeAgo date={new Date(datetime)} />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FormattedDateTime datetime={datetime} resolution="time" />
      </TooltipContent>
    </Tooltip>
  )
}

const VersionRow = ({
  organization,
  catalog,
}: {
  organization: schemas['Organization']
  catalog: schemas['Catalog']
}) => {
  const isDraft = catalog.status === 'draft'
  return (
    <Link
      href={`/dashboard/${organization.slug}/products/versions/${catalog.id}`}
    >
      <ListItem className="px-6 py-5">
        <Grid
          templateColumns="minmax(0, 1fr) auto 130px"
          columnGap="xl"
          alignItems="center"
          width="100%"
        >
          <Text
            variant="body"
            color={catalog.name || isDraft ? 'default' : 'muted'}
            truncate
          >
            {catalog.name ?? (isDraft ? 'Unpublished changes' : 'Untitled')}
          </Text>
          <Box>
            {catalog.status === 'archived' ? null : (
              <StatusBadge draft={isDraft} />
            )}
          </Box>
          <Text variant="body" color="muted" align="right">
            {isDraft ? 'Not published' : <PublishedAt catalog={catalog} />}
          </Text>
        </Grid>
      </ListItem>
    </Link>
  )
}

export default function VersionsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const searchParams = useSearchParams()
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const { data: catalogs, isLoading } = useCatalogs(
    organization.id,
    page,
    PAGE_SIZE,
  )

  return (
    <DashboardBody title="Versions">
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
              <VersionRow
                key={catalog.id}
                organization={organization}
                catalog={catalog}
              />
            ))}
          </List>
        </Pagination>
      ) : (
        <EmptyState
          icon={<HistoryRounded />}
          title="No versions yet"
          description="Apply your config to save a draft, then publish it to create a version."
        />
      )}
    </DashboardBody>
  )
}
