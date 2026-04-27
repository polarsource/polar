import { CONFIG } from '@/utils/config'
import { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AuthOnboarding from './AuthOnboarding'

export const metadata: Metadata = {
  title: 'Get started with Polar',
}

export default async function Page(props: {
  searchParams: Promise<{ intent?: string }>
}) {
  if (CONFIG.IS_SANDBOX) {
    redirect('/onboarding/sandbox')
  }

  const { intent } = await props.searchParams
  const resolvedIntent = intent === 'login' ? 'login' : 'signup'

  const cookieStore = await cookies()
  const lastLoginMethod =
    cookieStore.get('polar_last_login_method')?.value ?? null

  return (
    <AuthOnboarding
      intent={resolvedIntent}
      lastLoginMethod={lastLoginMethod}
    />
  )
}
