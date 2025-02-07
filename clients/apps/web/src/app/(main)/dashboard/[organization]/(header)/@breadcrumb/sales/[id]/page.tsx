import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrderById } from '@/utils/order'
import {
  BreadcrumbPageParams,
  BreadcrumbSeparator,
  CopyableBreadcrumbLink,
} from '../../Breadcrumb'

export default async function BreadcrumbPage({
  params,
}: {
  params: BreadcrumbPageParams & { id: string }
}) {
  const api = await getServerSideAPI()
  const order = await getOrderById(api, params.id)
  return (
    <>
      <BreadcrumbSeparator />
      <CopyableBreadcrumbLink
        href={`/dashboard/${params.organization}/sales/${order.id}`}
        text={order.id}
      >
        {order.id}
      </CopyableBreadcrumbLink>
    </>
  )
}
