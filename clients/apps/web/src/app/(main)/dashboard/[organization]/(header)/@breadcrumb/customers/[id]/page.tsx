import { getServerSideAPI } from '@/utils/api/serverside'
import { getCustomerById } from '@/utils/customer'
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
  const customer = await getCustomerById(api, params.id)
  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbLink
        href={`/dashboard/${params.organization}/customers/${customer.id}`}
      >
        {customer.name ? customer.name : customer.email}
      </BreadcrumbLink>
    </>
  )
}
