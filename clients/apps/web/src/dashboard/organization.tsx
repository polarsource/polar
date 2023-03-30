import { useRouter } from 'next/router'
import {
  IssueRead,
  IssueReferenceRead,
  IssueStatus,
  type Entry_Any_,
  type Entry_IssueRead_,
  type IssueListResponse,
  type OrganizationRead,
  type PledgeRead,
  type RepositoryRead,
} from 'polarkit/api/client'
import { IssueList } from 'polarkit/components'
import { useDashboard } from 'polarkit/hooks'
import { useEffect, useState } from 'react'
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

  // const { orgSlug, repoSlug } = useParams()
  const router = useRouter()
  const { organization, repo } = router.query

  let [statuses, setStatuses] = useState<Array<IssueStatus>>(
    buildStatusesFilter(filters),
  )
  useEffect(() => setStatuses(buildStatusesFilter(filters)), [props])

  const orgSlug = typeof organization === 'string' ? organization : ''
  const repoSlug = typeof repo === 'string' ? repo : ''

  const dashboardQuery = useDashboard(orgSlug, repoSlug, filters.q, statuses)
  const dashboard = dashboardQuery.data

  const [issues, setIssues] = useState<Entry_IssueRead_[]>()
  const [orgs, setOrgs] = useState<Map<string, OrganizationRead>>()
  const [pledges, setPledges] = useState<Map<string, PledgeRead>>()
  const [repos, setRepos] = useState<Map<string, RepositoryRead>>()
  const [references, setReferences] =
    useState<Map<string, IssueReferenceRead>>()
  const [dependencies, setDependencies] = useState<Map<string, IssueRead>>()

  useEffect(() => {
    setIssues(dashboard?.data || [])
    setOrgs(buildMapForType<OrganizationRead>(dashboard, 'organization'))
    setPledges(buildMapForType<PledgeRead>(dashboard, 'pledge'))
    setRepos(buildMapForType<RepositoryRead>(dashboard, 'repository'))
    setReferences(buildMapForType<IssueReferenceRead>(dashboard, 'reference'))
    setDependencies(buildMapForType<IssueRead>(dashboard, 'issue'))
  }, [dashboard])

  return (
    <div>
      <IssueList
        issues={issues}
        references={references}
        dependencies={dependencies}
        pledges={pledges}
        orgs={orgs}
        repos={repos}
      />
    </div>
  )
}

export default Organization
