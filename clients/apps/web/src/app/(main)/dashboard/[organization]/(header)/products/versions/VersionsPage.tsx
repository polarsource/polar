'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Pagination from '@/components/Pagination/Pagination'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useCatalogs } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { HistoryRounded } from '@polar-sh/orbit/icons'
import { useSearchParams } from 'next/navigation'
import { parseAsInteger, useQueryState } from 'nuqs'
import { useState } from 'react'
import { VersionRow } from './VersionRow'

const PAGE_SIZE = 20

export default function VersionsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const searchParams = useSearchParams()
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: catalogs, isLoading } = useCatalogs(
    organization.id,
    page,
    PAGE_SIZE,
  )
  const total = catalogs?.pagination.total_count ?? 0

  return (
    <DashboardBody title="Versions">
      <Box flexDirection="column" rowGap="xl">
        <Box maxWidth={640}>
          <Text color="muted">
            Every apply that changes a product publishes a version. New
            checkouts use the current one, and existing customers stay on the
            version they bought.
          </Text>
        </Box>
        {isLoading ? null : catalogs && catalogs.items.length > 0 ? (
          <Pagination
            currentPage={page}
            pageSize={PAGE_SIZE}
            totalCount={total}
            currentURL={searchParams}
            onPageChange={setPage}
          >
            <Box flexDirection="column" rowGap="l">
              {catalogs.items.map((catalog, index) => (
                <VersionRow
                  key={catalog.id}
                  catalog={catalog}
                  number={total - (page - 1) * PAGE_SIZE - index}
                  organization={organization}
                  expanded={expandedId === catalog.id}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === catalog.id ? null : catalog.id,
                    )
                  }
                  isFirst={index === 0}
                  isLast={index === catalogs.items.length - 1}
                />
              ))}
            </Box>
          </Pagination>
        ) : (
          <EmptyState
            icon={<HistoryRounded />}
            title="No versions yet"
            description="Change a product in your config and run polar config apply. The version it publishes shows up here."
          />
        )}
      </Box>
    </DashboardBody>
  )
}
