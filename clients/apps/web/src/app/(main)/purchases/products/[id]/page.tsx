import { getServerSideAPI } from '@/utils/client/serverside'
import { getProductById } from '@/utils/product'
import { unwrap } from '@polar-sh/client'
import { notFound, redirect } from 'next/navigation'

export default async function LegacyProductPurchasePage({
  params,
}: {
  params: { id: string }
}) {
  const api = getServerSideAPI()

  let product
  let organization

  try {
    product = await getProductById(api, params.id)
    organization = await unwrap(
      api.GET('/v1/organizations/{id}', {
        params: {
          path: { id: product.organization_id },
        },
      }),
    )
  } catch (error) {
    notFound()
  }

  redirect(`/${organization.slug}/portal`)
}
