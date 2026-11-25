import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import { getAuthenticatedUser } from '@/utils/user'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import AgentClaimSuccess from '../AgentClaimSuccess'
import { getAgentClaimDonePath } from '../claimContinuation'

export const metadata: Metadata = {
  title: 'Setup complete',
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const slug =
    typeof searchParams.organization === 'string' && searchParams.organization
      ? searchParams.organization
      : undefined

  if (!(await getAuthenticatedUser())) {
    redirect(
      `/auth?return_to=${encodeURIComponent(getAgentClaimDonePath(slug))}`,
    )
  }

  const organization = slug
    ? await getOrganizationBySlug(await getServerSideAPI(), slug, false)
    : undefined

  return <AgentClaimSuccess organization={organization ?? null} />
}
