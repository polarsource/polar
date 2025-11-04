import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; meterId: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()

  const { data: meter } = await api.GET('/v1/meters/{id}', {
    params: {
      path: { id: params.meterId },
    },
  })

  if (!meter) {
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

  if (!meter) {
    notFound()
  }

  return <ClientPage organization={organization} meter={meter} />
}
