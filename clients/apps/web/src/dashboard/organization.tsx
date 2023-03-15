import {
  IssueStatus,
  type Entry_Any_,
  type Entry_IssueRead_,
  type IssueRead,
  type RewardRead,
} from 'polarkit/api/client'
import { IssueList } from 'polarkit/components'
import { useDashboard, useRepositoryPullRequests } from 'polarkit/hooks'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DashboardFilters } from './filters'

const buildStatusesFilter = (filters: DashboardFilters): Array<IssueStatus> => {
  const next = []
  filters.statusBacklog && next.push(IssueStatus.BACKLOG)
  filters.statusBuild && next.push(IssueStatus.BUILDING)
  filters.statusPullRequest && next.push(IssueStatus.PULL_REQUEST)
  filters.statusCompleted && next.push(IssueStatus.COMPLETED)
  return next
}

const Organization = (props: { filters: DashboardFilters }) => {
  const { filters } = props

  const { orgSlug, repoSlug } = useParams()

  let [statuses, setStatuses] = useState<Array<IssueStatus>>(
    buildStatusesFilter(filters),
  )
  useEffect(() => setStatuses(buildStatusesFilter(filters)), [props])

  const dashboardQuery = useDashboard(orgSlug, repoSlug, filters.q, statuses)
  const dashboard = dashboardQuery.data

  // TODO: include pull requests in the dashboard query
  const repositoryPullRequestQuery = useRepositoryPullRequests(
    orgSlug,
    repoSlug,
  )
  const pullRequests = repositoryPullRequestQuery.data

  const issues: IssueRead[] =
    dashboard?.data.map((d: Entry_IssueRead_) => d.attributes) || []

  const rewards: RewardRead[] =
    dashboard?.included
      .filter((i: Entry_Any_) => i.type === 'reward')
      .map((r) => r.attributes) || []

  return (
    <div>
      <IssueList
        issues={issues}
        pullRequests={pullRequests}
        rewards={rewards}
      />
    </div>
  )
}

export default Organization
