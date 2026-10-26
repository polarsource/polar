import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { IncomePageHeader } from './IncomePageHeader'

export default async function Layout(props: {
  children: React.ReactNode
  params: Promise<{ organization: string }>
}) {
  const [params, api] = await Promise.all([props.params, getServerSideAPI()])
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
    false,
  )

  return (
    <DashboardBody
      wrapperClassName="gap-4"
      header={
        <IncomePageHeader
          organization={organization}
          className="hidden md:flex"
        />
      }
      titleActions={<IncomePageHeader organization={organization} />}
    >
      {props.children}
    </DashboardBody>
  )
}
