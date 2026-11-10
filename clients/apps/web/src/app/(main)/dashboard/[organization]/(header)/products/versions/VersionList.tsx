'use client'

import { useInfiniteCatalogs } from '@/hooks/queries/catalogs'
import { useInViewport } from '@/hooks/utils'
import { schemas } from '@polar-sh/client'
import {
  SegmentedControl,
  Spinner,
  Status,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import Link from 'next/link'
import { useParams, useRouter, useSelectedLayoutSegment } from 'next/navigation'
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
        flexDirection="column"
        paddingHorizontal="l"
        paddingVertical="m"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
        backgroundColor={
          selected ? 'background-card' : { hover: 'background-card' }
        }
      >
        <Box alignItems="center" columnGap="s" minWidth={0}>
          <Text color={catalog.name || isDraft ? 'default' : 'muted'} truncate>
            {catalog.name ?? (isDraft ? 'Unpublished changes' : 'Untitled')}
          </Text>
          {catalog.status === 'live' ? (
            <Status status="Current" color="gray" size="small" />
          ) : isDraft ? (
            <Status status="Draft" color="blue" size="small" />
          ) : null}
        </Box>
        <Text variant="caption" color="muted">
          {isDraft ? 'Not published' : <PublishedAt catalog={catalog} />}
        </Text>
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
  const segment = useSelectedLayoutSegment()
  const router = useRouter()
  const versionsPath = `/dashboard/${organization.slug}/products/versions`
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
        flexDirection="column"
        rowGap="m"
        paddingHorizontal="l"
        paddingVertical="l"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Text variant="body">Versions</Text>
        <SegmentedControl
          variant="tabs"
          size="sm"
          options={[
            { value: 'history', label: 'History' },
            { value: 'removed', label: 'Removed' },
          ]}
          value={segment === 'removed' ? 'removed' : 'history'}
          onChange={(tab) =>
            router.push(
              tab === 'removed' ? `${versionsPath}/removed` : versionsPath,
            )
          }
        />
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
