import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import EndpointsPage from './EndpointsPage'

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return <EndpointsPage organization={organization} />
}
