import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import EndpointsPage from './EndpointsPage'

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const [params, api] = await Promise.all([props.params, getServerSideAPI()])
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return <EndpointsPage organization={organization} />
}
