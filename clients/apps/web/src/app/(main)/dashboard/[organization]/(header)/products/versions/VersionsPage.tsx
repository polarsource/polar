'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Pagination from '@/components/Pagination/Pagination'
import { EmptyState } from '@/components/Shared/EmptyState'
import { schemas } from '@polar-sh/client'
import { Subnav, SubnavItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { HistoryRounded } from '@polar-sh/orbit/icons'
import { useSearchParams } from 'next/navigation'
import { parseAsInteger, parseAsStringLiteral, useQueryState } from 'nuqs'
import { PAGE_SIZE, useVersionHistory } from './history'
import { RemovedTab } from './RemovedTab'
import { Overview } from './Overview'
import { VersionsTab } from './VersionsTab'

const tabs = ['versions', 'removed'] as const

export const VersionsPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const searchParams = useSearchParams()
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const history = useVersionHistory(organization, page)
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(tabs).withDefault('versions'),
  )

  if (!history) {
    return (
      <DashboardBody title="Versions">
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text color="muted">Loading versions…</Text>
        </Box>
      </DashboardBody>
    )
  }

  if (!history.totalCount) {
    return (
      <DashboardBody title="Versions">
        <EmptyState
          icon={<HistoryRounded />}
          title="No versions yet"
          description="Apply your config to save a draft, then publish it to create a version."
        />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody title="Versions">
      <Box flexDirection="column" rowGap="2xl">
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
        {tab === 'versions' ? (
          <Box flexDirection="column" rowGap="2xl">
            <Overview organization={organization} history={history} />
            <Pagination
              currentPage={page}
              pageSize={PAGE_SIZE}
              totalCount={history.totalCount}
              onPageChange={setPage}
              currentURL={searchParams}
            >
              <VersionsTab organization={organization} history={history} />
            </Pagination>
          </Box>
        ) : (
          <RemovedTab organization={organization} />
        )}
      </Box>
    </DashboardBody>
  )
}
