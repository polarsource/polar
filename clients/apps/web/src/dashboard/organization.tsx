import { requireAuth } from 'polarkit/hooks'
import { useParams } from 'react-router-dom'
import { api } from 'polarkit'
import { IssueList } from 'polarkit/components'
import { useRepositoryIssues } from 'polarkit/hooks'

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

const Organization = () => {
  const { developer } = requireAuth()
  const { orgSlug, repoSlug } = useParams()

  const repositoryIssuesQuery = useRepositoryIssues(orgSlug, repoSlug)

  const issues = repositoryIssuesQuery.data


  return (
    <div>
      {orgSlug} / {repoSlug}

      <IssueList issues={issues} />
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
