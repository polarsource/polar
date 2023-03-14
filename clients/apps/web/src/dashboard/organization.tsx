import { api } from 'polarkit'
import { IssueList } from 'polarkit/components'
import {
  requireAuth,
  useDashboard,
  useRepositoryPullRequests,
} from 'polarkit/hooks'
import {
  type Entry_Any_,
  type Entry_IssueRead_,
  type IssueRead,
  type RewardRead,
} from 'polarkit/src/api/client'
import { useParams } from 'react-router-dom'
import { DashboardFilters } from './filters'

const StripeAccountLink = ({ organization, stripeId }) => {
  const redirect = async () => {
    const response = await api
      .get(
        `/api/organizations/${organization}/account/${stripeId}/stripe_login`,
      )
      .then((res) => {
        if (res.status == 200 && res.data.url) {
          window.location = res.data.url
        }
      })
  }

  return (
    <>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault()
          redirect()
        }}
      >
        Stripe Dashboard
      </a>
    </>
  )
}

const createLinks = async (organization_name: string, stripe_id: string) => {
  const response = await api
    .post(
      '/api/organizations/' +
        organization_name +
        '/account/' +
        stripe_id +
        '/links',
    )
    .then((res) => {
      if (res.status == 200 && res.data.url) {
        window.location = res.data.url
      }
    })
}

const createAccount = async (organization_name: string) => {
  const response = await api
    .post('/api/organizations/' + organization_name + '/account')
    .then((res) => {
      if (res.status == 200 && res.data?.stripe_id) {
        createLinks(organization_name, res.data.stripe_id)
      }
    })
}

const Organization = (props: { filters: DashboardFilters }) => {
  const { filters } = props

  const { developer } = requireAuth()
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

  const rewards2: RewardRead[] =
    dashboard?.included
      .filter((i: Entry_Any_) => i.type === 'reward')
      .map((r) => r.attributes) || []

  return (
    <div>
      <IssueList
        issues={issues}
        pullRequests={pullRequests}
        rewards={rewards2}
      />
    </div>
  )

  const organization = developer.getOrganizationBySlug(slug)

  return (
    <>
      <h1>{organization.name}</h1>

      {!organization.account && (
        <button
          onClick={(e) => {
            e.preventDefault()
            createAccount(organization.name)
          }}
        >
          Create Stripe Account
        </button>
      )}

      {organization.account && !organization.account.is_details_submitted && (
        <button
          onClick={(e) => {
            e.preventDefault()
            createLinks(organization.name, organization.account.stripe_id)
          }}
        >
          Stripe Onboarding
        </button>
      )}

      {organization.account && organization.account.is_details_submitted && (
        <StripeAccountLink
          organization={organization.name}
          stripeId={organization.account.stripe_id}
        />
      )}
    </>
  )
}

export default Organization
