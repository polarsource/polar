import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationSlugBySubscriptionIdOrNotFound } from '@/utils/storefront'
import { redirect } from 'next/navigation'

export default async function LegacySubscriptionPurchasePage({
  params,
}: {
  params: { id: string }
}) {
  const api = getServerSideAPI()
  const lookup = await getOrganizationSlugBySubscriptionIdOrNotFound(
    api,
    params.id,
  )
  redirect(`/${lookup.organization_slug}/portal`)
}
