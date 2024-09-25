import { getServerSideAPI } from '@/utils/api/serverside'
import { getCheckoutByClientSecret } from '@/utils/checkout'
import { getOrganizationById } from '@/utils/organization'

export default async function Page({
  params: { clientSecret },
}: {
  params: { clientSecret: string }
}) {
  const api = getServerSideAPI()

  const checkout = await getCheckoutByClientSecret(api, clientSecret)
  const organization = await getOrganizationById(
    api,
    checkout.product.organization_id,
  )
  return <div>{checkout.amount}</div>
}
