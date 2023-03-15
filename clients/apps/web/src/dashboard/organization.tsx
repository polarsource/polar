import {
  IssueStatus,
  type Entry_Any_,
  type Entry_IssueRead_,
  type IssueListResponse,
  type OrganizationRead,
  type RepositoryRead,
  type RewardRead,
} from 'polarkit/api/client'
import { IssueList } from 'polarkit/components'
import { useDashboard } from 'polarkit/hooks'
import { PullRequestRead } from 'polarkit/src/api/client'
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

interface IDer {
  id: string
}

const buildMapForType = <T extends IDer>(
  dashboard: IssueListResponse,
  typ: string,
): Map<string, T> => {
  const list: Entry_Any_[] =
    dashboard?.included.filter((i: Entry_Any_) => i.type === typ) || []
  return new Map<string, T>(list.map((r) => [r.id, r.attributes]))
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

  const [issues, setIssues] = useState<Entry_IssueRead_[]>()
  const [orgs, setOrgs] = useState<Map<string, OrganizationRead>>()
  const [rewards, setRewards] = useState<Map<string, RewardRead>>()
  const [repos, setRepos] = useState<Map<string, RepositoryRead>>()
  const [pullRequests, setPullRequests] =
    useState<Map<string, PullRequestRead>>()

  useEffect(() => {
    setIssues(dashboard?.data || [])
    setOrgs(buildMapForType<OrganizationRead>(dashboard, 'organization'))
    setRewards(buildMapForType<RewardRead>(dashboard, 'rewards'))
    setRepos(buildMapForType<RepositoryRead>(dashboard, 'repository'))
    setPullRequests(buildMapForType<PullRequestRead>(dashboard, 'pull_request'))
  }, [dashboard])

  return (
    <div>
      <IssueList
        issues={issues}
        pullRequests={pullRequests}
        rewards={rewards}
        orgs={orgs}
        repos={repos}
      />
    </div>
  )
}

export default Organization
