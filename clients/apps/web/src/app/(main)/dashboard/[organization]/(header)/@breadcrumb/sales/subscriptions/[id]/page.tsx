import { getServerSideAPI } from '@/utils/client/serverside'
import { getSubscriptionById } from '@/utils/subscription'
import {
  BreadcrumbPageParams,
  BreadcrumbSeparator,
  CopyableBreadcrumbLink,
} from '../../../Breadcrumb'

export default async function BreadcrumbPage({
  params,
}: {
  params: BreadcrumbPageParams & { id: string }
}) {
  const api = await getServerSideAPI()
  const subscription = await getSubscriptionById(api, params.id)
  return (
    <>
      <BreadcrumbSeparator />
      <CopyableBreadcrumbLink
        href={`/dashboard/${params.organization}/sales/subscriptions/${subscription.id}`}
        text={subscription.id}
      >
        {subscription.id}
      </CopyableBreadcrumbLink>
    </>
  )
}
