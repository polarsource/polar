import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { CONFIG } from '@/utils/config'
import { Metadata } from 'next'
import { cookies } from 'next/headers'
import Auth from '@/components/Auth/Auth'
import { getServerSideAPI } from '@/utils/client/serverside'
import { checkAuthenticationSession } from '@/utils/auth'
import { schemas } from '@polar-sh/client'
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

  if (
    authenticationSession &&
    authenticationSession.available_factors.includes('totp')
  ) {
    redirect('/auth/totp')
  }

  const { return_to } = searchParams

  const cookieStore = await cookies()
  const lastLoginMethod =
    cookieStore.get('polar_last_login_method')?.value ?? null

  return (
    <div className="flex h-screen w-full grow items-center justify-center">
      <div className="dark:bg-polar-900 flex w-full max-w-md flex-col justify-between gap-8 rounded-3xl bg-gray-50 p-12">
        <div className="flex flex-col gap-y-4">
          <PolarLogotype logoVariant="icon" size={60} />
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl text-black dark:text-white">
              {CONFIG.IS_SANDBOX
                ? 'Welcome to the Polar Sandbox'
                : 'Welcome to Polar'}
            </h2>
            <span className="dark:text-polar-400 text-lg text-balance text-gray-500">
              {CONFIG.IS_SANDBOX ? (
                <>
                  This is a testing environment. Changes here won&rsquo;t affect
                  your live account and payments are not processed.
                </>
              ) : (
                'Monetize your software'
              )}
            </span>
          </div>
          {searchParams.error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {searchParams.error}
            </div>
          )}
        </div>
        <Auth
          authenticationSession={authenticationSession}
          lastLoginMethod={lastLoginMethod as schemas['Factor'] | null}
          returnTo={return_to}
        />
      </div>
    </div>
  )
}
