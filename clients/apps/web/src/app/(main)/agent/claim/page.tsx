import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AGENT_CLAIM_RESUME_PARAM } from './claimContinuation'
import ClaimAgentPage from './ClaimAgentPage'

export const metadata: Metadata = {
  title: 'Claim your agent',
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const token = searchParams.token
  const resumeActionId = searchParams[AGENT_CLAIM_RESUME_PARAM]

  if (typeof token !== 'string' || !token) {
    notFound()
  }

  return (
    <ClaimAgentPage
      linkToken={token}
      resumeActionId={
        typeof resumeActionId === 'string' ? resumeActionId : undefined
      }
    />
  )
}
