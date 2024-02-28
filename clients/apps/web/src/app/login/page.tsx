import Login from '@/components/Auth/Login'
import { getServerSideAPI } from '@/utils/api'
import { UserRead } from '@polar-sh/sdk'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Login to Polar',
}

export default async function Page({
  searchParams: { return_to, for_organization_id },
}: {
  searchParams: { return_to?: string; for_organization_id?: string }
}) {
  // If the user is already logged in
  const api = getServerSideAPI()

  let user: UserRead | undefined = undefined
  try {
    user = await api.users.getAuthenticated()
  } catch {}

  if (user && user.id) {
    // User is authenticated, and want to authenticate on polar.sh.
    // Redirect to /feed
    if (!for_organization_id) {
      // Redirect to feed
      redirect(return_to ?? '/feed')
    }

    // User is authenticated, and want to login on a custom domain site.
    // Get a token and redirect back to the custom domain.

    const auth = await api.auth.customDomainForward({
      organizationId: for_organization_id,
    })

    const pt = parseJwt(auth.token)

    const domain = pt['domain']
    if (!domain) {
      throw new Error('Unexpected custom domain forward token (no domain)')
    }
    if (pt['type'] !== 'custom_domain_forward') {
      throw new Error(
        'Unexpected custom domain forward token (unexpected type)',
      )
    }

    // Redirect with token
    redirect(
      `https://${domain}/api/auth/custom_domain_exchange?token=${auth.token}`,
    )
  }

  return <Login returnTo={return_to} />
}

const parseJwt = (token: string): any => {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
}
