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
import { Check, Copy, HistoryRounded } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import { useSearchParams } from 'next/navigation'
import { parseAsInteger, useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'

const PAGE_SIZE = 20

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const publishedAt = (catalog: schemas['Catalog']) =>
  catalog.published_at ?? catalog.created_at

const CopyHashButton = ({ hash }: { hash: string }) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy version hash'}
      className="group/copy"
      onClick={() =>
        navigator.clipboard.writeText(hash).then(() => setCopied(true))
      }
    >
      <Box
        as="span"
        display="flex"
        alignItems="center"
        columnGap="xs"
        color={{ base: 'text-tertiary', hover: 'text-primary' }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        <Text as="span" variant="body" color="inherit" monospace>
          {hash.slice(0, 7)}
        </Text>
        <span
          className={
            copied
              ? 'flex'
              : 'flex opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/copy:opacity-100'
          }
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </span>
      </Box>
    </button>
  )
}

const CurrentBadge = () => (
  <Box
    as="span"
    display="inline-flex"
    paddingHorizontal="m"
    paddingVertical="xs"
    borderRadius="full"
    backgroundColor="background-inverse"
  >
    <Text as="span" color="inverse">
      Current
    </Text>
  </Box>
)

const PublishedAt = ({ catalog }: { catalog: schemas['Catalog'] }) => {
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

const VersionRow = ({ catalog }: { catalog: schemas['Catalog'] }) => (
  <ListItem className="px-6 py-5">
    <Grid
      templateColumns="88px minmax(0, 1fr) auto 130px"
      columnGap="xl"
      alignItems="center"
      width="100%"
    >
      <Box>
        {catalog.version_hash ? (
          <CopyHashButton hash={catalog.version_hash} />
        ) : null}
      </Box>
      <Text variant="body" color={catalog.name ? 'default' : 'muted'} truncate>
        {catalog.name ?? 'Untitled'}
      </Text>
      <Box>{catalog.status === 'live' ? <CurrentBadge /> : null}</Box>
      <Text variant="body" color="muted" align="right">
        <PublishedAt catalog={catalog} />
      </Text>
    </Grid>
  </ListItem>
)

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
    </DashboardBody>
  )
}
