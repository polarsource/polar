import { IssueList } from 'polarkit/components'
import { useDashboard, useRepositoryPullRequests } from 'polarkit/hooks'
import {
  type Entry_Any_,
  type Entry_IssueRead_,
  type IssueRead,
  type RewardRead,
} from 'polarkit/src/api/client'
import { useParams } from 'react-router-dom'
import { DashboardFilters } from './filters'

const Organization = (props: { filters: DashboardFilters }) => {
  const { filters } = props

  const { orgSlug, repoSlug } = useParams()

  const dashboardQuery = useDashboard(orgSlug, repoSlug, filters.q)
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
