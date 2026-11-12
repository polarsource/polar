'use client'

// PROTOTYPE: full-width versions page with a Versions tab and a Removed tab,
// replacing the list panel. Throwaway.
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import { schemas } from '@polar-sh/client'
import { Subnav, SubnavItem } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { HistoryRounded } from '@polar-sh/orbit/icons'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useVersionHistory } from './history'
import { RemovedTab } from './RemovedTab'
import { Loading } from './shared'
import { Overview } from './Overview'
import { VersionsTab } from './VersionsTab'

const tabs = ['versions', 'removed'] as const

export const VersionsPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const history = useVersionHistory(organization)
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(tabs).withDefault('versions'),
  )

  if (!history) {
    return (
      <DashboardBody title="Versions">
        <Loading />
      </DashboardBody>
    )
  }

  if (!history.versions.length) {
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
              ['versions', 'History'],
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
            <VersionsTab organization={organization} history={history} />
          </Box>
        ) : (
          <RemovedTab organization={organization} history={history} />
        )}
      </Box>
    </DashboardBody>
  )
}
