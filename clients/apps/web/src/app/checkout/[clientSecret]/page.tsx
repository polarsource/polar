import { Checkout } from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getCheckoutByClientSecret } from '@/utils/checkout'
import { getOrganizationById } from '@/utils/organization'
import { CheckoutStatus } from '@polar-sh/sdk'
import { redirect } from 'next/navigation'

export default async function Page({
  params: { clientSecret },
  searchParams: { embed: _embed, theme },
}: {
  params: { clientSecret: string }
  searchParams: { embed?: string; theme?: 'light' | 'dark' }
}) {
  const embed = _embed === 'true'
  const api = getServerSideAPI()

  const checkout = await getCheckoutByClientSecret(api, clientSecret)

  if (checkout.status !== CheckoutStatus.OPEN) {
    redirect(checkout.success_url)
  }

  const organization = await getOrganizationById(
    api,
    checkout.product.organization_id,
  )

  return (
    <CheckoutLayout embed={embed} theme={theme}>
      <Checkout
        organization={organization}
        checkout={checkout}
        theme={theme}
        embed={embed}
      />
    </CheckoutLayout>
  )
}
