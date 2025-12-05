import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getProductById } from '@/utils/product'
import { Metadata } from 'next'
import ProductsPage from './ProductsPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; id: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const product = await getProductById(api, params.id)
  return {
    title: product.name, // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  const product = await getProductById(api, params.id)

  return <ProductsPage organization={organization} product={product} />
}
