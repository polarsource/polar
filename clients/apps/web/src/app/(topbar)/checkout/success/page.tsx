import CheckoutSuccess from '@/components/Checkout/CheckoutSuccess'
import { getServerSideAPI } from '@/utils/api/serverside'
import { Checkout, Organization, ResponseError } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'

export default async function Page({
  searchParams,
}: {
  searchParams: { session_id: string }
}) {
  const api = getServerSideAPI()

  let checkout: Checkout | undefined

  try {
    checkout = await api.checkouts.get({
      id: searchParams.session_id,
    })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  let organization: Organization | undefined
  try {
    organization = await api.organizations.get({
      id: checkout.product.organization_id,
    })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  return <CheckoutSuccess checkout={checkout} organization={organization} />
}
