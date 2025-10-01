import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationSlugBySubscriptionIdOrNotFound } from '@/utils/storefront'
import { redirect } from 'next/navigation'

export default async function LegacySubscriptionPurchasePage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const lookup = await getOrganizationSlugBySubscriptionIdOrNotFound(
    api,
    params.id,
  )
  redirect(`/${lookup.organization_slug}/portal`)
}
