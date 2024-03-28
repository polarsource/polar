import Login from '@/components/Auth/Login'
import { getServerSideAPI } from '@/utils/api'
import { UserRead } from '@polar-sh/sdk'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CONFIG } from 'polarkit/config'

export const metadata: Metadata = {
  title: 'Login to Polar',
}

export default async function Page({
  searchParams: { return_to, for_organization_id, force },
}: {
  searchParams: {
    return_to?: string
    for_organization_id?: string
    force?: string
  }
}) {
  // If the user is already logged in
  const api = getServerSideAPI()

  let user: UserRead | undefined = undefined
  try {
    user = await api.users.getAuthenticated()
  } catch {}

  if (user && user.id && force !== 'true') {
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

  if (for_organization_id) {
    // Return to this page with for_organization_id set after logged in
    // The redirect handler above will redirect back to the custom domain
    const customDomainReturnTo = new URL(`${CONFIG.FRONTEND_BASE_URL}/login`)
    if (return_to) {
      customDomainReturnTo.searchParams.append('return_to', return_to)
    }
    customDomainReturnTo.searchParams.append(
      'for_organization_id',
      for_organization_id,
    )

    return <Login returnTo={customDomainReturnTo.toString()} />
  }

  return <Login returnTo={return_to} />
}

const parseJwt = (token: string): any => {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
}
