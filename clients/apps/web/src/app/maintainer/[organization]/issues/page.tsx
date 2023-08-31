'use client'

import OrganizationIssues from '@/components/Dashboard/OrganizationIssues'
import {
  DashboardFilters,
  DefaultFilters,
} from '@/components/Dashboard/filters'
import { useToast } from '@/components/Toast/use-toast'
import Head from 'next/head'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  IssueListType,
  IssueSortBy,
  IssueStatus,
  Organization,
  Repository,
} from 'polarkit/api/client'
import { useSSE } from 'polarkit/hooks'
import { useEffect, useRef, useState } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // const { organization: orgSlug, repo: repoSlug, status } = searchParams

  const orgSlug = searchParams?.get('organization')
  const repoSlug = searchParams?.get('repo')
  const status = searchParams?.get('status')

  const { toast } = useToast()
  const { org, repo, isLoaded } = useCurrentOrgAndRepoFromURL()
  const key = `org-${orgSlug}-repo-${repoSlug}` // use key to force reload of state

  useEffect(() => {
    if (isLoaded && !org) {
      router.push('/maintainer')
      return
    }
  }, [isLoaded, org, router])

  useEffect(() => {
    if (status === 'stripe-connected') {
      toast({
        title: 'Stripe setup complete',
        description: 'Your account is now ready to accept pledges.',
      })
    }
  }, [status, toast])

  if (!isLoaded) {
    return <></>
  }

  return (
    <>
      <Head>
        <title>Polar{org ? ` ${org.name}` : ''}</title>
      </Head>
      <Issues key={key} org={org} repo={repo} />
    </>
  )
}

const buildStatusesFilter = (filters: DashboardFilters): Array<IssueStatus> => {
  const next = []
  filters.statusBacklog && next.push(IssueStatus.BACKLOG)
  filters.statusTriaged && next.push(IssueStatus.TRIAGED)
  filters.statusInProgress && next.push(IssueStatus.IN_PROGRESS)
  filters.statusPullRequest && next.push(IssueStatus.PULL_REQUEST)
  filters.statusClosed && next.push(IssueStatus.CLOSED)
  return next
}

const getSort = (sort: string | null): IssueSortBy => {
  if (sort === 'newest') {
    return IssueSortBy.NEWEST
  }
  if (sort === 'pledged_amount_desc') {
    return IssueSortBy.PLEDGED_AMOUNT_DESC
  }
  if (sort === 'relevance') {
    return IssueSortBy.RELEVANCE
  }
  if (sort === 'dependencies_default') {
    return IssueSortBy.DEPENDENCIES_DEFAULT
  }
  if (sort === 'most_positive_reactions') {
    return IssueSortBy.MOST_POSITIVE_REACTIONS
  }
  if (sort === 'most_engagement') {
    return IssueSortBy.MOST_ENGAGEMENT
  }
  return IssueSortBy.NEWEST
}

const Issues = ({
  org,
  repo,
}: {
  org: Organization | undefined
  repo: Repository | undefined
}) => {
  const search = useSearchParams()

  const initFilters = {
    ...DefaultFilters,
  }

  const didSetFiltersFromURL = useRef(false)

  const [filters, setFilters] = useState<DashboardFilters>(initFilters)

  // TODO: Unless we're sending user-only events we should probably delay SSE
  useSSE(org?.platform, org?.name, undefined)

  useEffect(() => {
    // Parse URL and use it to populate filters
    // TODO: can we do this on the initial load instead to avoid the effect / and ref
    if (!didSetFiltersFromURL.current) {
      didSetFiltersFromURL.current = true

      const s = search

      const f: DashboardFilters = {
        ...DefaultFilters,
        q: s?.get('q') || '',
        tab: IssueListType.ISSUES,
      }
      if (s?.has('statuses')) {
        const stat = s.get('statuses')
        if (stat) {
          const statuses = stat.split(',')
          f.statusBacklog = statuses.includes('backlog')
          f.statusTriaged = statuses.includes('triaged')
          f.statusInProgress = statuses.includes('in_progress')
          f.statusPullRequest = statuses.includes('pull_request')
          f.statusClosed = statuses.includes('closed')
        }
      }
      if (s?.has('sort')) {
        f.sort = getSort(s.get('sort'))
      }
      if (s?.has('onlyPledged')) {
        f.onlyPledged = true
      }
      if (s?.has('onlyBadged')) {
        f.onlyBadged = true
      }

      setFilters(f)
    }
  }, [search])

  let [statuses, setStatuses] = useState<Array<IssueStatus>>(
    buildStatusesFilter(filters),
  )

  useEffect(() => setStatuses(buildStatusesFilter(filters)), [filters])

  if (!org || !org.name) {
    return <></>
  }

  return (
    <OrganizationIssues
      filters={filters}
      onSetFilters={setFilters}
      statuses={statuses}
      orgName={org.name}
      repoName={repo?.name}
    />
  )
}
