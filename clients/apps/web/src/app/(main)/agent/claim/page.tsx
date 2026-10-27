import { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import {
  checkAuthenticationSession,
  getAuthenticationSessionRedirectPath,
  type LoginMethod,
} from '@/utils/auth'
import { getServerSideAPI } from '@/utils/client/serverside'
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

  const api = await getServerSideAPI()
  const authenticationSession = await checkAuthenticationSession(api)
  const redirectPath = getAuthenticationSessionRedirectPath(
    authenticationSession,
  )
  if (redirectPath) {
    redirect(redirectPath)
  }

  const cookieStore = await cookies()
  const lastLoginMethod =
    cookieStore.get('polar_last_login_method')?.value ?? null

  return (
    <ClaimAgentPage
      linkToken={token}
      resumeActionId={
        typeof resumeActionId === 'string' ? resumeActionId : undefined
      }
      authenticationSession={authenticationSession}
      lastLoginMethod={lastLoginMethod as LoginMethod | null}
    />
  )
}
