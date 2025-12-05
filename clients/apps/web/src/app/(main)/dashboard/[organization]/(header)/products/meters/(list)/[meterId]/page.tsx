import { getServerSideAPI } from '@/utils/client/serverside'
import {
  getOrganizationBySlug,
  getOrganizationBySlugOrNotFound,
} from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MetersPage from './MetersPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; meterId: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlug(api, params.organization)

  if (!organization) {
    return {
      title: 'Meter Not Found',
    }
  }

  const { data: meter } = await api.GET('/v1/meters/{id}', {
    params: {
      path: { id: params.meterId },
    },
  })

  if (!meter || meter.organization_id !== organization.id) {
    return {
      title: 'Meter Not Found',
    }
  }

  return {
    title: meter.name,
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; meterId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const { data: meter } = await api.GET('/v1/meters/{id}', {
    params: {
      path: { id: params.meterId },
    },
  })

  if (!meter || meter.organization_id !== organization.id) {
    notFound()
  }

  return <MetersPage organization={organization} meter={meter} />
}
