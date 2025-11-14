import { ThemePresetProvider } from '@/providers/ThemePresetProvider'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import { PortalWrapper } from './PortalWrapper'

export const dynamic = 'force-dynamic'

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const api = await getServerSideAPI()
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return (
    <ThemePresetProvider organizationSlug={organization.slug}>
      <PortalWrapper organization={organization}>{children}</PortalWrapper>
    </ThemePresetProvider>
  )
}
