import CostsSidebarFilters from '@/components/Costs/CostsSidebarFilters'
import { CostsSidebarTitle } from '@/components/Costs/CostsSidebarTitle'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ organization: string }>
}) {
  const resolvedParams = await params
  const organizationSlug = resolvedParams.organization
  const organization = await getOrganizationBySlugOrNotFound(organizationSlug)

  return (
    <DashboardBody
      title={null}
      contextViewPlacement="left"
      contextViewTitle="Spans"
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
