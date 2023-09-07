'use client'

import IssueList from '@/components/Dashboard/IssueList'
import Tab from '@/components/Dashboard/Tab'
import Tabs from '@/components/Dashboard/Tabs'
import {
  DashboardFilters,
  DefaultFilters,
} from '@/components/Dashboard/filters'
import Recommended from '@/components/Feed/Recommended'
import FundAGithubIssue from '@/components/Onboarding/FundAGithubIssue'
import { useAuth } from '@/hooks'
import { IssueListType, IssueStatus } from 'polarkit/api/client'
import { usePersonalDashboard } from 'polarkit/hooks'
import { useState } from 'react'

export default function Page() {
  const { currentUser } = useAuth()

  const filters: DashboardFilters = {
    ...DefaultFilters,
    tab: IssueListType.DEPENDENCIES,
    onlyPledged: true,
  }

  const [tab, setTab] = useState('active')

  const activeStatuses = [
    IssueStatus.BACKLOG,
    IssueStatus.BUILDING,
    IssueStatus.IN_PROGRESS,
    IssueStatus.PULL_REQUEST,
    IssueStatus.TRIAGED,
  ]

  const completedStatuses = [IssueStatus.CLOSED]

  const [statuses, setStatuses] = useState(activeStatuses)

  const setActive = () => {
    setTab('active')
    setStatuses(activeStatuses)
  }

  const setCompleted = () => {
    setTab('completed')
    setStatuses(completedStatuses)
  }

  const dashboardQuery = usePersonalDashboard(
    filters.tab,
    filters.q,
    statuses,
    filters.sort,
    filters.onlyPledged,
    filters.onlyBadged,
  )
  const dashboard = dashboardQuery.data
  const totalCount = dashboard?.pages[0].pagination.total_count ?? undefined

  return (
    <div className="mt-2 space-y-10">
      <div className="space-y-10 lg:px-5">
        <FundAGithubIssue />

        <div>
          <div className="flex w-full items-center justify-between">
            <h1 className="text-lg text-gray-900 dark:text-gray-300">
              Funded issues
            </h1>

            <div>
              <Tabs>
                <>
                  <Tab active={tab === 'active'} onClick={() => setActive()}>
                    Active
                  </Tab>
                  <Tab
                    active={tab === 'completed'}
                    onClick={() => setCompleted()}
                  >
                    Completed
                  </Tab>
                </>
              </Tabs>
            </div>
          </div>

          {totalCount === 0 && tab === 'active' && (
            <div className="text-sm text-gray-500">
              You haven&apos;t funded any issues, maybe you&apos;ll get find
              inspiration from the recommendations below?
            </div>
          )}
          {totalCount === 0 && tab === 'completed' && (
            <div className="text-sm text-gray-500">
              There are no completed issues to be seen around here.
            </div>
          )}

          <IssueList
            totalCount={totalCount}
            loading={dashboardQuery.isLoading}
            dashboard={dashboard}
            filters={filters}
            onSetFilters={() => {}}
            isInitialLoading={dashboardQuery.isInitialLoading}
            isFetchingNextPage={dashboardQuery.isFetchingNextPage}
            hasNextPage={dashboardQuery.hasNextPage || false}
            fetchNextPage={dashboardQuery.fetchNextPage}
            showSelfPledgesFor={currentUser}
          />
        </div>
      </div>

      <Recommended />
    </div>
  )
}
