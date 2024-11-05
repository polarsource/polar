import { Checkout } from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getCheckoutByClientSecret } from '@/utils/checkout'
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

  return (
    <CheckoutLayout checkout={checkout} embed={embed} theme={theme}>
      <Checkout
        organization={checkout.organization}
        checkout={checkout}
        theme={theme}
        embed={embed}
      />
    </CheckoutLayout>
  )
}
