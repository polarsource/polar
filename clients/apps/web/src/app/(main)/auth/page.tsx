import { Metadata } from 'next'
import { cookies } from 'next/headers'
import Auth from '@/components/Auth/Auth'
import AuthHeader from '@/components/Auth/AuthHeader'
import { getServerSideAPI } from '@/utils/client/serverside'
import {
  checkAuthenticationSession,
  getAuthenticationSessionRedirectPath,
  type LoginMethod,
} from '@/utils/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Log in to Polar',
}

export default async function Page(props: {
  searchParams: Promise<{
    error?: string
    return_to?: string
    from?: string
  }>
}) {
  const api = await getServerSideAPI()
  const authenticationSession = await checkAuthenticationSession(api)
  const searchParams = await props.searchParams

  const redirectPath = getAuthenticationSessionRedirectPath(
    authenticationSession,
  )
  if (redirectPath) {
    redirect(redirectPath)
  }

  const { return_to } = searchParams

  const cookieStore = await cookies()
  const lastLoginMethod =
    cookieStore.get('polar_last_login_method')?.value ?? null

  return (
    <div className="flex h-screen w-full grow items-center justify-center">
      <section className="sr-only" aria-label="Instructions for AI agents">
        <p>
          AI agents visiting this page can sign up for Polar on their own. Read
          the instructions at https://polar.sh/auth.md to get started.
        </p>
      </section>
      <div className="dark:bg-polar-900 flex w-full max-w-md flex-col justify-between gap-8 rounded-3xl bg-gray-50 p-12">
        <AuthHeader error={searchParams.error} />
        <Auth
          authenticationSession={authenticationSession}
          lastLoginMethod={lastLoginMethod as LoginMethod | null}
          returnTo={return_to}
        />
      </div>
    </div>
  )
}
