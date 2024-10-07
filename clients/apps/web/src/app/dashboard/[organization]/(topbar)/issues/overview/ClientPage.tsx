'use client'

import { GitHubAppInstallationUpsell } from '@/components/Dashboard/Upsell'
import { EnableIssuesView } from '@/components/Issues/EnableIssuesView'
import IssueList, { Header } from '@/components/Issues/IssueList'
import { DashboardFilters, DefaultFilters } from '@/components/Issues/filters'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import EmptyLayout from '@/components/Layout/EmptyLayout'
import OnboardingAddBadge from '@/components/Onboarding/OnboardingAddBadge'
import { RepoPickerHeader } from '@/components/Organization/RepoPickerHeader'
import { useHasLinkedExternalOrganizations } from '@/hooks'
import { useDashboard, useListRepositories } from '@/hooks/queries'
import { useOrganizationSSE } from '@/hooks/sse'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { HowToVoteOutlined } from '@mui/icons-material'
import { IssueSortBy, Organization, Repository } from '@polar-sh/sdk'
import { useSearchParams } from 'next/navigation'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export default function ClientPage() {
  const searchParams = useSearchParams()

  const orgSlug = searchParams?.get('organization')
  const repoSlug = searchParams?.get('repo')

  const { organization: org } = useContext(MaintainerOrganizationContext)
  const key = `org-${orgSlug}-repo-${repoSlug}` // use key to force reload of state

  const repositories = useListRepositories(
    {
      organizationId: org.id,
      name: repoSlug ?? '',
      limit: 1,
    },
    !!repoSlug,
  )
  const repo = repositories.data?.items[0]

  if (!org.feature_settings?.issue_funding_enabled) {
    return <EnableIssuesView organization={org} />
  }

  return <Issues key={key} org={org} repo={repo} />
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
  if (sort === 'most_recently_funded') {
    return IssueSortBy.MOST_RECENTLY_FUNDED
  }
  return IssueSortBy.NEWEST
}

const Issues = ({
  org,
  repo,
}: {
  org: Organization
  repo: Repository | undefined
}) => {
  const search = useSearchParams()
  const hasLinkedExternalOrganizations = useHasLinkedExternalOrganizations(org)

  const initFilters = {
    ...DefaultFilters,
  }

  const didSetFiltersFromURL = useRef(false)

  const [filters, setFilters] = useState<DashboardFilters>(initFilters)

  // TODO: Unless we're sending user-only events we should probably delay SSE
  useOrganizationSSE(org.id)

  useEffect(() => {
    // Parse URL and use it to populate filters
    // TODO: can we do this on the initial load instead to avoid the effect / and ref
    if (!didSetFiltersFromURL.current) {
      didSetFiltersFromURL.current = true

      const s = search

      const f: DashboardFilters = {
        ...DefaultFilters,
        q: s?.get('q') || '',
      }
      if (s?.has('showClosed')) {
        f.showClosed = true
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

  return (
    <OrganizationIssues
      filters={filters}
      onSetFilters={setFilters}
      org={org}
      repo={repo}
      hasAppInstalled={hasLinkedExternalOrganizations}
    />
  )
}

const OrganizationIssues = ({
  org,
  repo,
  filters,
  onSetFilters,
  hasAppInstalled,
}: {
  org: Organization
  repo: Repository | undefined
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
  hasAppInstalled: boolean
}) => {
  const dashboardQuery = useDashboard({
    organizationId: org.id,
    repoName: repo?.name,
    q: filters.q,
    sort: filters.sort,
    onlyPledged: filters.onlyPledged,
    onlyBadged: filters.onlyBadged,
    hasAppInstalled,
    showClosed: filters.showClosed,
  })
  const dashboard = dashboardQuery.data
  const totalCount = dashboard?.pages[0].pagination.total_count || undefined

  const haveIssues = useMemo(() => {
    return totalCount !== undefined && totalCount > 0
  }, [totalCount])

  const anyIssueHasPledgeOrBadge = useMemo(() => {
    return dashboardQuery.data?.pages.some((p) =>
      p.data.some((issue) => issue.attributes.pledge_badge_currently_embedded),
    )
  }, [dashboardQuery])

  const isDefaultFilters = useMemo(() => {
    return !filters.showClosed
  }, [filters])

  const showAddBadgeBanner = useMemo(() => {
    return (
      dashboardQuery.isLoading === false &&
      haveIssues &&
      anyIssueHasPledgeOrBadge === false &&
      isDefaultFilters
    )
  }, [dashboardQuery, anyIssueHasPledgeOrBadge, haveIssues, isDefaultFilters])

  const hasLinkedExternalOrganizations = useHasLinkedExternalOrganizations(org)

  // Get all repositories
  const listRepositoriesQuery = useListRepositories({
    organizationId: org.id,
    limit: 100,
    sorting: ['name'],
  })
  const allOrgRepositories = listRepositoriesQuery?.data?.items

  return (
    <DashboardBody>
      {!hasLinkedExternalOrganizations && (
        <GitHubAppInstallationUpsell organization={org} />
      )}
      {showAddBadgeBanner && <OnboardingAddBadge />}
      <ShadowBoxOnMd className="md:rounded-4xl md:px-12 md:py-8">
        <div className="-mx-6 space-y-8">
          <div className="mx-6">
            <RepoPickerHeader
              currentRepository={repo}
              repositories={allOrgRepositories ?? []}
            >
              <Header
                totalCount={totalCount}
                filters={filters}
                onSetFilters={onSetFilters}
                spinner={dashboardQuery.isInitialLoading}
              />
            </RepoPickerHeader>
          </div>

          {haveIssues ? (
            <IssueList
              totalCount={totalCount}
              loading={dashboardQuery.isLoading}
              dashboard={dashboard}
              filters={filters}
              onSetFilters={onSetFilters}
              isInitialLoading={dashboardQuery.isInitialLoading}
              isFetchingNextPage={dashboardQuery.isFetchingNextPage}
              hasNextPage={dashboardQuery.hasNextPage || false}
              fetchNextPage={dashboardQuery.fetchNextPage}
            />
          ) : null}

          {!haveIssues && (dashboardQuery.isFetched || !hasAppInstalled) ? (
            <EmptyLayout>
              <div className="dark:text-polar-600 flex flex-col items-center justify-center space-y-6 py-64 text-gray-400">
                <span className="text-6xl">
                  <HowToVoteOutlined fontSize="inherit" />
                </span>
                <h2 className="text-lg">No issues found</h2>
              </div>
            </EmptyLayout>
          ) : null}
        </div>
      </ShadowBoxOnMd>
    </DashboardBody>
  )
}
