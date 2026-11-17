'use client'

import { useCustomerEmailUpdateVerify } from '@/hooks/queries/customerPortal'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PortalText } from '@/components/CustomerPortal/PortalPrimitives'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { PortalAuthHeader, PortalAuthShell } from '../PortalShell'

const VerifyEmailPage = ({
  organization,
  token,
  tokenValid,
}: {
  organization: schemas['CustomerOrganization']
  token?: string
  tokenValid: boolean
}) => {
  const router = useRouter()
  const verify = useCustomerEmailUpdateVerify()

  const onConfirm = useCallback(async () => {
    if (!token) return
    const sessionToken = (await verify.mutateAsync({ token }))?.token
    if (!sessionToken) return
    router.push(
      `/${organization.slug}/portal/settings?customer_session_token=${sessionToken}`,
    )
  }, [token, verify, router, organization.slug])

  if (!token || !tokenValid) {
    return (
      <PortalAuthShell organization={organization}>
        <PortalAuthHeader
          title="Invalid link"
          description="This verification link is invalid or has expired."
        />
      </PortalAuthShell>
    )
  }

  if (verify.isSuccess) {
    return (
      <PortalAuthShell organization={organization}>
        <PortalAuthHeader
          title="Email updated"
          description="Your email has been updated. Redirecting you to the customer portal…"
        />
      </PortalAuthShell>
    )
  }

  return (
    <PortalAuthShell organization={organization}>
      <Box flexDirection="column" rowGap="xl">
        <PortalAuthHeader
          title="Verify new email"
          description={`You're updating your email address for ${organization.name}. Once confirmed, you'll use this new email to access your purchases.`}
        />

        {verify.error && (
          <PortalText tone="danger" className="text-sm">
            {verify.error.message}
          </PortalText>
        )}

        <Button
          size="lg"
          fullWidth
          onClick={onConfirm}
          loading={verify.isPending}
          disabled={verify.isPending}
        >
          Confirm email change
        </Button>

        <PortalText tone="tertiary" className="text-sm">
          Changed your mind? You can safely ignore this and your current email
          will remain active.
        </PortalText>
      </Box>
    </PortalAuthShell>
  )
}

export default VerifyEmailPage
