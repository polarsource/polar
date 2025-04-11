import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getProductById } from '@/utils/product'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata({
  params,
}: {
  params: { organization: string; id: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const product = await getProductById(api, params.id)
  return {
    title: product.name, // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string; id: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  const product = await getProductById(api, params.id)

  return <ClientPage organization={organization} product={product} />
}
