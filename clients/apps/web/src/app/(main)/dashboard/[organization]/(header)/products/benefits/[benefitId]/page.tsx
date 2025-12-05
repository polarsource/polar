import { getServerSideAPI } from '@/utils/client/serverside'
import {
  getOrganizationBySlug,
  getOrganizationBySlugOrNotFound,
} from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BenefitPage from './BenefitPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; benefitId: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlug(api, params.organization)

  if (!organization) {
    return {
      title: 'Benefit Not Found',
    }
  }

  const { data: benefit } = await api.GET('/v1/benefits/{id}', {
    params: {
      path: { id: params.benefitId },
    },
  })

  if (!benefit || benefit.organization_id !== organization.id) {
    return {
      title: 'Benefit Not Found',
    }
  }

  const title = benefit.description

  return {
    title, // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; benefitId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const { data: benefit } = await api.GET('/v1/benefits/{id}', {
    params: {
      path: { id: params.benefitId },
    },
  })

  if (!benefit || benefit.organization_id !== organization.id) {
    notFound()
  }

  return <BenefitPage organization={organization} benefit={benefit} />
}
