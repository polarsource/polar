import { VoidHeader } from '@/components/Void/VoidHeader'
import { PolarThemeProvider } from '@/app/providers'
import { OrganizationContextProvider } from '@/providers/maintainerOrganization'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getAuthenticatedUser } from '@/utils/user'
import { VoidGrid, VoidItem } from '@/components/Void/VoidGrid'
import { Box } from '@polar-sh/orbit/Box'
import { notFound, redirect } from 'next/navigation'

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
    // Same access enforcement as the main dashboard layout: SSO members must
    // re-authenticate, non-members get a 404 (no leak).
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
    <PolarThemeProvider>
      <OrganizationContextProvider
        organization={organization}
        organizations={organizations}
        memberOrganizations={memberOrganizations}
      >
        <Box
          minHeight="100vh"
          backgroundColor="background-primary"
          flexDirection="column"
        >
          <VoidGrid
            width="100%"
            paddingHorizontal={{ base: 'xl', md: '3xl' }}
            paddingVertical="xl"
            rowGap="none"
            flexGrow={1}
          >
            <VoidItem span={{ base: 12, lg: 2 }}>
              <VoidHeader
                organizationName={organization.name}
                organizationSlug={organization.slug}
              />
            </VoidItem>
            <VoidItem span={{ base: 12, lg: 10 }}>{children}</VoidItem>
          </VoidGrid>
        </Box>
      </OrganizationContextProvider>
    </PolarThemeProvider>
  )
}
