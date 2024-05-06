'use client'

import { GitHubAppInstallationUpsell } from '@/components/Dashboard/Upsell'
import { EnableIssuesView } from '@/components/Issues/EnableIssuesView'
import IssueList, { Header } from '@/components/Issues/IssueList'
import { DashboardFilters, DefaultFilters } from '@/components/Issues/filters'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import EmptyLayout from '@/components/Layout/EmptyLayout'
import OnboardingAddBadge from '@/components/Onboarding/OnboardingAddBadge'
import { RepoPickerHeader } from '@/components/Organization/RepoPickerHeader'
import { useToast } from '@/components/Toast/use-toast'
import { useDashboard, useListRepositories } from '@/hooks/queries'
import { useSSE } from '@/hooks/sse'
import { HowToVoteOutlined } from '@mui/icons-material'
import { IssueSortBy, Organization, Repository } from '@polar-sh/sdk'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { Separator } from 'polarkit/components/ui/separator'
import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../../../hooks'

export default function ClientPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

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

  if (org && !org.issue_funding_enabled) {
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

  if (!org || !org.name) {
    return <></>
  }

  return (
    <OrganizationIssues
      filters={filters}
      onSetFilters={setFilters}
      orgName={org.name}
      repoName={repo?.name}
      hasAppInstalled={org.has_app_installed}
    />
  )
}

const OrganizationIssues = ({
  orgName,
  repoName,
  filters,
  onSetFilters,
  hasAppInstalled,
}: {
  orgName: string
  repoName: string | undefined
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
  hasAppInstalled: boolean
}) => {
  const dashboardQuery = useDashboard({
    orgName,
    repoName,
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
  }, [
    filters,
    dashboardQuery,
    anyIssueHasPledgeOrBadge,
    haveIssues,
    isDefaultFilters,
  ])

  // Get current org & repo from URL
  const { org: currentOrg, repo: currentRepo } = useCurrentOrgAndRepoFromURL()

  // Get all repositories
  const listRepositoriesQuery = useListRepositories()
  const allRepositories = listRepositoriesQuery?.data?.items

  // Filter repos by current org & normalize for our select
  const allOrgRepositories = allRepositories?.filter(
    (r) => r?.organization?.id === currentOrg?.id,
  )

  if (!currentOrg || (!allRepositories && hasAppInstalled)) {
    return <></>
  }

  return (
    <DashboardBody className="flex flex-col gap-y-8">
      {!currentOrg.has_app_installed && <GitHubAppInstallationUpsell />}
      {showAddBadgeBanner && <OnboardingAddBadge />}
      <ShadowBoxOnMd className="md:rounded-3xl md:px-12 md:py-8">
        <h2 className="mb-6 text-lg font-medium">Issues Overview</h2>
        <div className="-mx-6 space-y-8">
          <div className="mx-6">
            <RepoPickerHeader
              currentRepository={currentRepo}
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

          <div className="px-6">
            <Separator />
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
