import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import ChangePlanPage from './ChangePlanPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Change plan', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  return <ChangePlanPage organization={organization} />
}
