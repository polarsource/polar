import { getServerSideAPI } from '@/utils/client/serverside'
import { getSubscriptionById } from '@/utils/subscription'
import { unwrap } from '@polar-sh/client'
import { notFound, redirect } from 'next/navigation'

export default async function LegacySubscriptionPurchasePage({
  params,
}: {
  params: { id: string }
}) {
  const api = getServerSideAPI()

  let subscription
  let organization

  try {
    subscription = await getSubscriptionById(api, params.id)
    organization = await unwrap(
      api.GET('/v1/organizations/{id}', {
        params: {
          path: { id: subscription.product.organization_id },
        },
      }),
    )
  } catch (error) {
    notFound()
  }

  redirect(`/${organization.slug}/portal`)
}
