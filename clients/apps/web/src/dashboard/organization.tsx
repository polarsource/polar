import { useRouter } from 'next/router'
import { IssueStatus } from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import { IssueList } from 'polarkit/components'
import { useDashboard } from 'polarkit/hooks'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import yayson from 'yayson'
import { DashboardFilters } from './filters'

const y = yayson({ adapter: 'default' })
const store = new y.Store()

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

const Organization = (props: {
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
}) => {
  const { filters } = props

  // const { orgSlug, repoSlug } = useParams()
  const router = useRouter()
  const { organization, repo } = router.query

  let [statuses, setStatuses] = useState<Array<IssueStatus>>(
    buildStatusesFilter(filters),
  )
  useEffect(() => setStatuses(buildStatusesFilter(filters)), [props, filters])

  const orgSlug = typeof organization === 'string' ? organization : ''
  const repoSlug = typeof repo === 'string' ? repo : ''

  const dashboardQuery = useDashboard(
    orgSlug,
    repoSlug,
    filters.tab,
    filters.q,
    statuses,
    filters.sort,
  )
  const dashboard = dashboardQuery.data

  const [issues, setIssues] = useState<IssueReadWithRelations[]>()

  useEffect(() => {
    if (dashboard) {
      const issues: IssueReadWithRelations[] = store.sync(dashboard)
      setIssues(issues)
    }
  }, [dashboard])

  return (
    <div>
      <IssueList
        issues={issues}
        filters={filters}
        onSetFilters={props.onSetFilters}
      />
    </div>
  )
}

export default Organization
