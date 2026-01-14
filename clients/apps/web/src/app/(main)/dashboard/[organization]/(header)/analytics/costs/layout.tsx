import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import CostsSidebarFilters from './components/CostsSidebarFilters'
import { CostsSidebarTitle } from './components/CostsSidebarTitle'

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ organization: string }>
}) {
  const resolvedParams = await params
  const organizationSlug = resolvedParams.organization
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    organizationSlug,
  )

  return (
    <DashboardBody
      title={null}
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <div className="flex h-full flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between gap-6 px-4 pt-4">
            <CostsSidebarTitle organizationSlug={organizationSlug} />
          </div>
          <CostsSidebarFilters organization={organization} />
        </div>
      }
      wide
    >
      {children}
    </DashboardBody>
  )
}
