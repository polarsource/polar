'use client'

import { useInfiniteCatalogs } from '@/hooks/queries/catalogs'
import { useInViewport } from '@/hooks/utils'
import { schemas } from '@polar-sh/client'
import {
  Pill,
  Spinner,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const publishedAt = (catalog: schemas['Catalog']) =>
  catalog.published_at ?? catalog.created_at

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
  selected,
}: {
  organization: schemas['Organization']
  catalog: schemas['Catalog']
  selected: boolean
}) => {
  const isDraft = catalog.status === 'draft'
  return (
    <Link
      href={`/dashboard/${organization.slug}/products/versions/${catalog.id}`}
    >
      <Box
        alignItems="baseline"
        columnGap="s"
        paddingHorizontal="l"
        paddingVertical="m"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
        backgroundColor={
          selected ? 'background-card' : { hover: 'background-card' }
        }
      >
        <Box flexDirection="column" flex={1} minWidth={0}>
          <Text truncate>{catalog.name ?? 'Untitled'}</Text>
          <Text variant="caption" color="muted">
            {isDraft ? 'Not published' : <PublishedAt catalog={catalog} />}
          </Text>
        </Box>
        {catalog.status === 'live' ? (
          <Pill color="gray">Current</Pill>
        ) : isDraft ? (
          <Pill color="blue">Draft</Pill>
        ) : null}
      </Box>
    </Link>
  )
}

export const VersionListSidebar = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { id: selectedId } = useParams<{ id?: string }>()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteCatalogs(organization.id)
  const { ref: loadingRef, inViewport } = useInViewport()

  useEffect(() => {
    if (inViewport && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <Box flexDirection="column" height="100%">
      <Box
        paddingHorizontal="l"
        paddingVertical="l"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Text variant="body">Versions</Text>
      </Box>
      <Box flexDirection="column" overflowY="auto" flexGrow={1}>
        {data?.pages
          .flatMap((page) => page.items)
          .map((catalog) => (
            <VersionRow
              key={catalog.id}
              organization={organization}
              catalog={catalog}
              selected={catalog.id === selectedId}
            />
          ))}
        {hasNextPage ? (
          <Box ref={loadingRef} justifyContent="center" paddingVertical="2xl">
            <Spinner />
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
