import { getServerSideAPI } from '@/utils/client/serverside'
import { getMeterById } from '@/utils/meter'
import {
  BreadcrumbLink,
  BreadcrumbPageParams,
  BreadcrumbSeparator,
} from '../../Breadcrumb'

export default async function BreadcrumbPage({
  params,
}: {
  params: BreadcrumbPageParams & { id: string }
}) {
  const api = await getServerSideAPI()
  const meter = await getMeterById(api, params.id)
  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbLink
        href={`/dashboard/${params.organization}/meters/${meter.id}`}
      >
        {meter.name}
      </BreadcrumbLink>
    </>
  )
}
