import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationSlugByProductIdOrNotFound } from '@/utils/storefront'
import { redirect } from 'next/navigation'

export default async function LegacyProductPurchasePage({
  params,
}: {
  params: { id: string }
}) {
  const api = getServerSideAPI()
  const lookup = await getOrganizationSlugByProductIdOrNotFound(api, params.id)
  redirect(`/${lookup.organization_slug}/portal`)
}
