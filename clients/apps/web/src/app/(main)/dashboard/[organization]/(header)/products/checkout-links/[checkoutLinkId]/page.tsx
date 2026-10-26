import { getServerSideAPI } from '@/utils/client/serverside'
import {
  getOrganizationBySlug,
  getOrganizationBySlugOrNotFound,
} from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CheckoutLinksPage from './CheckoutLinksPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; checkoutLinkId: string }>
}): Promise<Metadata> {
  const [params, api] = await Promise.all([props.params, getServerSideAPI()])
  const organization = await getOrganizationBySlug(api, params.organization)

  if (!organization) {
    return {
      title: 'Checkout Link Not Found',
    }
  }

  const { data: checkoutLink } = await api.GET('/v1/checkout-links/{id}', {
    params: {
      path: { id: params.checkoutLinkId },
    },
  })

  if (!checkoutLink || checkoutLink.organization_id !== organization.id) {
    return {
      title: 'Checkout Link Not Found',
    }
  }

  const title = checkoutLink.label ?? 'Untitled Checkout Link'

  return {
    title,
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; checkoutLinkId: string }>
}) {
  const [params, api] = await Promise.all([props.params, getServerSideAPI()])
  const [organization, { data: checkoutLink }] = await Promise.all([
    getOrganizationBySlugOrNotFound(api, params.organization),
    api.GET('/v1/checkout-links/{id}', {
      params: {
        path: { id: params.checkoutLinkId },
      },
    }),
  ])

  if (!checkoutLink || checkoutLink.organization_id !== organization.id) {
    notFound()
  }

  return (
    <CheckoutLinksPage
      organization={organization}
      checkoutLink={checkoutLink}
    />
  )
}
