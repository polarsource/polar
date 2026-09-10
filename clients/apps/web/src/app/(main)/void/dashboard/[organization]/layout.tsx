import ImpersonationBanner from '@/components/Impersonation/ImpersonationBanner'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { AccountSetupProvider } from '@/providers/accountSetup'
import { OrganizationContextProvider } from '@/providers/maintainerOrganization'
import { getServerSideAPI } from '@/utils/client/serverside'
import {
  getOrganizationBySlug,
  getOrganizationBySlugOrNotFound,
} from '@/utils/organization'
import { getAuthenticatedUser } from '@/utils/user'
import { SidebarProvider } from '@polar-sh/ui/components/ui/sidebar'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
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
      <AccountSetupProvider>
        <ImpersonationBanner />
        <SidebarProvider open>
          <DashboardLayout>{children}</DashboardLayout>
        </SidebarProvider>
      </AccountSetupProvider>
    </OrganizationContextProvider>
  )
}
