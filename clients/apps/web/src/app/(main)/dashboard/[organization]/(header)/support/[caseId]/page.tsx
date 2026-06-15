import { SupportCaseView } from '@/components/Organization/Support/SupportCaseView'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Support',
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; caseId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return <SupportCaseView organization={organization} caseId={params.caseId} />
}
