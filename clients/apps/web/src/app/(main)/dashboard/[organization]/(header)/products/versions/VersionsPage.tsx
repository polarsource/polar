'use client'

import { useCatalogs, useRemovedCatalogItems } from '@/hooks/queries/catalogs'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Pagination from '@/components/Pagination/Pagination'
import { EmptyState } from '@/components/Shared/EmptyState'
import { schemas } from '@polar-sh/client'
import { Alert, Subnav, SubnavItem } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { HistoryRounded } from '@polar-sh/orbit/icons'
import { useSearchParams } from 'next/navigation'
import { parseAsInteger, parseAsStringLiteral, useQueryState } from 'nuqs'
import { RemovedTab } from './RemovedTab'
import { Overview } from './Overview'
import { VersionsTab } from './VersionsTab'

const tabs = ['versions', 'removed'] as const
const PAGE_SIZE = 20

const HistoryTab = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const searchParams = useSearchParams()
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const { data, isError, refetch } = useCatalogs(
    organization.id,
    page,
    PAGE_SIZE,
  )

  if (isError) {
    return (
      <Alert
        variant="danger"
        title="Could not load versions"
        actions={[{ text: 'Retry', onClick: () => refetch() }]}
      />
    )
  }

  if (!data) return null

  if (!data.pagination.total_count) {
    return (
      <EmptyState
        icon={<HistoryRounded />}
        title="No versions yet"
        description="Apply your config to save a draft, then publish it to create a version."
      />
    )
  }

  return (
    <Box flexDirection="column" rowGap="2xl">
      <Overview organization={organization} catalogs={data.items} />
      <Pagination
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalCount={data.pagination.total_count}
        onPageChange={setPage}
        currentURL={searchParams}
      >
        <VersionsTab organization={organization} catalogs={data.items} />
      </Pagination>
    </Box>
  )
}

export const VersionsPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(tabs).withDefault('versions'),
  )
  const { data: removed, isError } = useRemovedCatalogItems(organization.id)
  // On error, keep the tabs so the Removed tab can show its alert and retry
  const hasRemoved = !!removed?.length || isError

  return (
    <DashboardBody title="Versions">
      <Box flexDirection="column" rowGap="2xl">
        {hasRemoved && (
          <Subnav label="Version sections">
            {(
              [
                ['versions', 'Overview'],
                ['removed', 'Removed'],
              ] as const
            ).map(([value, label]) => (
              <SubnavItem key={value} active={tab === value}>
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              </SubnavItem>
            ))}
          </Subnav>
        )}
        {hasRemoved && tab === 'removed' ? (
          <RemovedTab organization={organization} />
        ) : (
          <HistoryTab organization={organization} />
        )}
      </Box>
    </DashboardBody>
  )
}
