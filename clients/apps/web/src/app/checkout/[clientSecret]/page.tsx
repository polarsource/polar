import { Checkout } from '@/components/Checkout/Checkout'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getCheckoutByClientSecret } from '@/utils/checkout'
import { getOrganizationById } from '@/utils/organization'
import { CheckoutStatus } from '@polar-sh/sdk'
import { redirect } from 'next/navigation'

export default async function Page({
  params: { clientSecret },
}: {
  params: { clientSecret: string }
}) {
  const api = getServerSideAPI()

  const checkout = await getCheckoutByClientSecret(api, clientSecret)

  if (checkout.status !== CheckoutStatus.OPEN) {
    redirect(`/checkout/${clientSecret}/confirmation`)
  }

  const organization = await getOrganizationById(
    api,
    checkout.product.organization_id,
  )
  return <Checkout organization={organization} checkout={checkout} />
}
