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
