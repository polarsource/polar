import { AccountSetupProvider } from '@/providers/accountSetup'
import { OrganizationContextProvider } from '@/providers/maintainerOrganization'
import { getServerSideAPI } from '@/utils/client/serverside'
import {
  getOrganizationBySlug,
  getOrganizationBySlugOrNotFound,
} from '@/utils/organization'
import { getAuthenticatedUser } from '@/utils/user'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  // Non-throwing: access is enforced in the layout, so metadata must not 404 a
  // member who needs to re-authenticate through SSO.
  const organization = await getOrganizationBySlug(api, params.organization)
  if (!organization) {
    return { title: 'Polar' }
  }
  return {
    title: {
      template: `%s | ${organization.name} | Polar`,
      default: organization.name,
    },
  }
}

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params
  const { children } = props
  const slug = params.organization

  const user = await getAuthenticatedUser()
  const organizations = user?.organizations ?? []
  const memberOrganizations = user?.member_organizations ?? []

  if (!organizations.some((org) => org.slug === slug)) {
    // Not accessible in this session. A member of an org that enforces SSO must
    // re-authenticate through SSO; a non-member gets a 404 (no leak).
    const membership = memberOrganizations.find((org) => org.slug === slug)
    if (membership?.requires_sso) {
      redirect(`/auth/sso/${slug}`)
    }
    if (!membership) {
      notFound()
    }
    redirect('/dashboard')
  }

  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(api, slug)

  return (
    <OrganizationContextProvider
      organization={organization}
      organizations={organizations}
      memberOrganizations={memberOrganizations}
    >
      <AccountSetupProvider>{children}</AccountSetupProvider>
    </OrganizationContextProvider>
  )
}
