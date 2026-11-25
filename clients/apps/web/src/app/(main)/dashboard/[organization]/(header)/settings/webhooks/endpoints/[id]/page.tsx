import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import EndpointsPage from './EndpointsPage'

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  return <EndpointsPage organization={organization} />
}
