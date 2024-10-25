import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import {
  BreadcrumbLink,
  BreadcrumbPageParams,
  BreadcrumbSeparator,
} from './Breadcrumb'

export default async function BreadcrumbLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: BreadcrumbPageParams
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  return (
    <div className="flex flex-row items-center gap-x-0.5 font-mono text-xs">
      <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
      <BreadcrumbSeparator />
      <BreadcrumbLink href={`/dashboard/${organization.slug}`}>
        {organization.name}
      </BreadcrumbLink>
      {children}
    </div>
  )
}
