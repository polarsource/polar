import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationSlugByProductIdOrNotFound } from '@/utils/storefront'
import { redirect } from 'next/navigation'

export default async function LegacyProductPurchasePage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const lookup = await getOrganizationSlugByProductIdOrNotFound(api, params.id)
  redirect(`/${lookup.organization_slug}/portal`)
}
